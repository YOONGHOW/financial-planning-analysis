import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { audioData, mimeType } = await req.json();
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API_KEY is not configured in the server environment variables." },
        { status: 500 }
      );
    }

    if (!audioData) {
      return NextResponse.json({ error: "Missing audioData payload." }, { status: 400 });
    }

    // Google Cloud Speech-to-Text API v1 Endpoint
    const gcloudSpeechUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

    // Map browser mimeType to Google Cloud Speech-to-Text encoding format
    // WebM Opus is the standard for modern browsers (Chrome, Edge, Firefox)
    let encoding = "WEBM_OPUS";
    let sampleRateHertz = 48000;

    const payload = {
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
      },
      audio: {
        content: audioData,
      },
    };

    const res = await fetch(gcloudSpeechUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Google Speech API error response:", errorText);
      return NextResponse.json({ error: "Google Speech API transcription failed." }, { status: 500 });
    }

    const data = await res.json();
    
    // Combine transcription alternatives
    const transcript = data.results
      ?.map((result) => result.alternatives?.[0]?.transcript || "")
      .join(" ")
      .trim() || "";

    return NextResponse.json({ text: transcript });
  } catch (error) {
    console.error("Google Speech API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

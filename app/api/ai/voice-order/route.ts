import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceIntent, DEFAULT_WHISPER_CONFIG, transcribeWithWhisper } from '@/lib/voice-order-service';

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;
    const fallbackTranscript = formData.get('transcript') as string | null;

    let transcript = '';
    let mode: 'whisper' | 'browser_sr' | 'manual' = 'manual';
    let confidence = 1.0;

    if (fallbackTranscript) {
      // Browser SpeechRecognition already did the job
      transcript = fallbackTranscript.trim().slice(0, 300);
      mode = 'browser_sr';
      confidence = 0.85;
    } else if (audioFile) {
      // Try local Whisper
      const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });
      const whisperResult = await transcribeWithWhisper(audioBlob, DEFAULT_WHISPER_CONFIG);

      if (whisperResult && whisperResult.transcript) {
        transcript = whisperResult.transcript;
        confidence = whisperResult.confidence;
        mode = 'whisper';
      } else {
        return NextResponse.json({
          error: 'Whisper unavailable',
          mode: 'whisper',
          fallback: 'Use browser speech recognition',
        }, { status: 503 });
      }
    } else {
      return NextResponse.json({ error: 'No audio or transcript provided' }, { status: 400 });
    }

    if (!transcript) {
      return NextResponse.json({ error: 'Empty transcript' }, { status: 400 });
    }

    // Parse intent
    const intent = parseVoiceIntent(transcript);

    return NextResponse.json({
      transcript,
      confidence,
      intent,
      mode,
      processingMs: Date.now() - start,
    });
  } catch (error) {
    console.error('Voice order error:', error);
    return NextResponse.json({ error: 'Voice processing failed' }, { status: 500 });
  }
}

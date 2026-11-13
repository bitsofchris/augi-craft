// Speech to text by running a local command on a WAV file. The default uses
// MacWhisper's CLI with its whisper.cpp base model; set VOICE_STT_CMD to use
// another tool, with {file} where the audio path goes, e.g.
//   VOICE_STT_CMD='whisper-cli -m ggml-base.en.bin -nt -np -f {file}'
import { execFile } from 'node:child_process'

export const DEFAULT_STT_CMD = '/Applications/MacWhisper.app/Contents/MacOS/mw transcribe --model whisper-cpp:ggml-model-whisper-base --language en {file}'

/** Split a command template into argv, substituting {file}. Quotes are not supported. */
export function commandFor (template, file) {
  const argv = template.trim().split(/\s+/).map(a => a === '{file}' ? file : a)
  if (!argv.includes(file)) argv.push(file)
  return argv
}

/** Collapse the tool's output into one line of transcript. */
export function cleanTranscript (out) {
  return String(out ?? '')
    .split('\n')
    .filter(line => !/^Transcribing .*\.\.\.$/.test(line.trim())) // mw progress line
    .join(' ')
    .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ') // [BLANK_AUDIO], (music) and similar tags
    .replace(/\s+/g, ' ')
    .trim()
}

export function createTranscriber ({ template = process.env.VOICE_STT_CMD || DEFAULT_STT_CMD, timeoutMs = 20_000, run = execFile } = {}) {
  return file => new Promise((resolve, reject) => {
    const [cmd, ...args] = commandFor(template, file)
    run(cmd, args, { timeout: timeoutMs }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`transcription failed: ${String(stderr || err.message).trim().slice(0, 200)}`))
      resolve(cleanTranscript(stdout))
    })
  })
}

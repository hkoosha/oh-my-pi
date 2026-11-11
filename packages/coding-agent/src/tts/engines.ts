/**
 * In-process TTS engines contributed by extensions (`pi.registerTtsEngine`).
 *
 * An engine is keyed `provider/model`, matching the `local-inference` speech
 * model the registration adds to the catalog, so the speech role selects it
 * like any built-in local model. {@link TtsClient} routes keys found here to
 * the engine instead of the Kokoro worker; the vocalizer, `omp say`, and the
 * `tts` tool all resolve through {@link localSpeechModelKey}.
 */

/** Decoded mono PCM in [-1, 1]. */
export interface TtsEngineAudio {
	pcm: Float32Array;
	sampleRate: number;
}

export interface TtsEngineRequest {
	/** Voice id; set only when the engine lists it in {@link TtsEngine.voices}. */
	voice?: string;
	/** Speaking rate (1 = normal) from the caller's settings; engines may ignore it. */
	speed?: number;
	/** Aborted when the caller stops listening (interrupt, new turn, shutdown). */
	signal: AbortSignal;
}

export interface TtsEngine {
	/** Model display name in selectors. */
	name: string;
	/** Voices the engine accepts; others are not forwarded. */
	voices?: readonly string[];
	/** Synthesize one speakable segment (a sentence or short paragraph). */
	synthesize(text: string, request: TtsEngineRequest): Promise<TtsEngineAudio>;
	/** Release processes or handles; called when the TTS client shuts down (e.g. after `omp say`). */
	dispose?(): void | Promise<void>;
}

const engines = new Map<string, TtsEngine>();

export function ttsEngineKey(provider: string, model: string): string {
	return `${provider}/${model}`;
}

/** Register or replace the engine for `key`. */
export function registerTtsEngine(key: string, engine: TtsEngine): void {
	engines.set(key, engine);
}

export function unregisterTtsEngine(key: string): void {
	engines.delete(key);
}

export function getTtsEngine(key: string): TtsEngine | undefined {
	return engines.get(key);
}

/** Dispose every registered engine; failures are ignored so shutdown always completes. */
export async function disposeTtsEngines(): Promise<void> {
	await Promise.allSettled([...engines.values()].map(async engine => engine.dispose?.()));
}

/** Key the TTS client synthesizes a `local-inference` speech model with. */
export function localSpeechModelKey(model: { provider: string; id: string }): string {
	const key = ttsEngineKey(model.provider, model.id);
	return engines.has(key) ? key : model.id;
}

/** The engine's voice argument: forwarded only when the engine declares it. */
export function engineVoice(engine: TtsEngine, voice: string | undefined): string | undefined {
	return voice !== undefined && engine.voices?.includes(voice) ? voice : undefined;
}

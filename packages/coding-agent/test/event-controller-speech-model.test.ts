import { afterEach, beforeAll, beforeEach, expect, it } from "bun:test";
import type { Model } from "@oh-my-pi/pi-ai";
import { resetSettingsForTest, Settings, settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { EventController } from "@oh-my-pi/pi-coding-agent/modes/controllers/event-controller";
import { registerTtsEngine, unregisterTtsEngine } from "@oh-my-pi/pi-coding-agent/tts/engines";
import { vocalizer } from "@oh-my-pi/pi-coding-agent/tts/vocalizer";
import { initTheme } from "@oh-my-pi/pi-tui/theme";
import { createInteractiveModeContext } from "./helpers/interactive-mode-context";

const voice = {
	provider: "ext",
	id: "voice",
	name: "Extension voice",
	api: "local-inference",
	kind: "tts",
	baseUrl: "local://ext",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 4096,
	maxTokens: 4096,
} as unknown as Model;

beforeAll(async () => {
	await initTheme(false);
});

beforeEach(async () => {
	resetSettingsForTest();
	await Settings.init({ inMemory: true, overrides: { "speech.enabled": true } });
	settings.setModelRole("speech", "ext/voice");
});

afterEach(() => {
	vocalizer.clear();
	vocalizer.setModelSource(null);
	unregisterTtsEngine("ext/voice");
	resetSettingsForTest();
});

it("spoken replies use the session's speech role, including extension engines", async () => {
	const spoken: string[] = [];
	const { promise: called, resolve } = Promise.withResolvers<void>();
	registerTtsEngine("ext/voice", {
		name: "Extension voice",
		synthesize: async text => {
			spoken.push(text);
			resolve();
			// Failing ends the utterance before any audio reaches a real player.
			throw new Error("test engine produces no audio");
		},
	});
	const ctx = createInteractiveModeContext({
		session: { settings, modelRegistry: { getAvailable: () => [voice] } },
	});
	new EventController(ctx);

	vocalizer.pushDelta("Work is done.");
	vocalizer.flush();
	await called;

	expect(spoken).toEqual(["Work is done."]);
});

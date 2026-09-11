import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";
import { FileSystemIconLoader } from "unplugin-icons/loaders";
import Icons from "unplugin-icons/vite";

// ADAPTER=vercel -> serverless build for the public demo (Vercel).
// Anything else (unset) -> standalone Node server for Docker / bare-metal.
const adapter =
	process.env.ADAPTER === "vercel"
		? vercel({
				webAnalytics: { enabled: true },
			})
		: node({ mode: "standalone" });

export default defineConfig({
	output: "server",
	adapter,
	server: {
		port: 30001,
	},
	vite: {
		plugins: [
			tailwindcss(),
			Icons({
				compiler: "vue3",
				customCollections: {
					app: FileSystemIconLoader("./src/icons"),
				},
			}),
		],
	},
	integrations: [
		AstroPWA({
			// Prompt (not autoUpdate): a waiting SW stays inactive until the
			// user clicks Update in UpdatePrompt.vue, so mid-form work is not
			// wiped by a silent reload after a deploy.
			registerType: "prompt",
			includeAssets: [
				"favicon.svg",
				"favicon.ico",
				"apple-touch-icon.png",
				"robots.txt",
			],
			manifest: {
				name: "lets-talie",
				short_name: "lets-talie",
				description: "A self-hosted expense tracking and group transaction app",
				theme_color: "#ffffff",
				// Brand mint, so the launch splash doesn't frame the icon in white.
				background_color: "#ddfff7",
				// Regenerated from logo/logo.svg by `bun run assets:icons`.
				// The 1024px entries exist because Android scales the largest
				// icon it can find up to the launcher/splash size — without them
				// the installed icon is visibly soft on 3x/4x screens.
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "pwa-1024x1024.png",
						sizes: "1024x1024",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "pwa-maskable-192x192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "maskable",
					},
					{
						src: "pwa-maskable-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
					{
						src: "pwa-maskable-1024x1024.png",
						sizes: "1024x1024",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				navigateFallback: "/",
				globPatterns: ["**/*.{css,js,html,svg,png,ico,txt}"],
			},
		}),
		vue(),
	],
});

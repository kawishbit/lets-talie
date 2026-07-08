import vue from "@astrojs/vue";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	server: {
		port: 30001,
	},
	vite: {
		plugins: [tailwindcss()],
	},
	integrations: [
		AstroPWA({
			registerType: "autoUpdate",
			includeAssets: ["favicon.svg", "robots.txt"],
			manifest: {
				name: "lets-talie",
				short_name: "lets-talie",
				description: "A self-hosted expense tracking and group transaction app",
				theme_color: "#ffffff",
				icons: [
					{
						src: "pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
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

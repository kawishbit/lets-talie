export function formatDate(iso: string) {
	return new Date(iso).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false, // Forces 24-hour format
	});
}

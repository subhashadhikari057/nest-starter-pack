export function buildVariantDisplayName(
	masterName?: string | null,
	variantName?: string | null,
	onlyMasterName = false,
): string {
	const masterLabel = masterName?.trim() ?? "";
	const variantLabel = variantName?.trim() ?? "";

	if (onlyMasterName) {
		return masterLabel;
	}

	if (masterLabel && variantLabel) {
		return `${masterLabel} - ${variantLabel}`;
	}

	return masterLabel || variantLabel || "";
}

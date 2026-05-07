export const MODULES = [
	"System",
	"Users",
	"Roles",
	"Permissions",
	"Categories",
	"Tags",
	"Featured",
	"Products",
	"Promotions",
	"Orders",
	"Cart",
	"Settings",
	"Activity",
	"Subscriptions",
	"SubscriptionModules",
	"SubscriptionTiers",
	"SubscriptionPlans",
	"SubscriptionTierPrices",
	"SubscriptionTierFeatures",
	"Communications",
	"ContentSeries",
	"Content",
	"ContentUnlockRules",
	"Livestream",
	"Courses",
	"Payments",
	"Training",
	"Training_SESSION",
	"Training_Cohort",
	"Booklet",
	"Podcast",
	"SupportRequests",
	"Feedback",
	"Testimonials",
	"Nepse",
	"Consultation",
] as const;

export const CRUD_ACTIONS = ["CREATE", "READ", "UPDATE", "DELETE"] as const;

export type ModuleName = (typeof MODULES)[number];
export type PermissionAction = (typeof CRUD_ACTIONS)[number];
export type ModulePermissionCode = `${ModuleName}_${PermissionAction}`;

export const CUSTOM_PERMISSION_CODES = [
	"ConsultationSlots_READ",
	"ConsultationSlots_CREATE",
	"ConsultationSlots_UPDATE",
	"ConsultationSlots_DELETE",
	"ConsultationBookings_READ",
	"ConsultationBookings_UPDATE",
] as const;

export type CustomPermissionCode = (typeof CUSTOM_PERMISSION_CODES)[number];
export type PermissionCode = ModulePermissionCode | CustomPermissionCode;

export const buildModulePermissions = (
	module: ModuleName,
	actions: PermissionAction[] = [...CRUD_ACTIONS],
): PermissionCode[] =>
	actions.map((action) => `${module}_${action}` satisfies ModulePermissionCode);

import type { EventContext } from "@/modules/notifications/transactional/types";

import { renderCourseAccessGranted } from "@/modules/notifications/transactional/email-templates/render-course-access-email";

function createCourseContext(overrides?: Partial<EventContext>): EventContext {
	return {
		orderId: 8001,
		orderNumber: "ORD-COURSE-8001",
		userId: "user-8001",
		email: "student@example.com",
		userName: "Nabin",
		finalPayable: 50000,
		orderStatus: "paid" as EventContext["orderStatus"],
		productId: 301,
		productType: "course",
		productTitle: "NEPSE Technical Analysis",
		courseDescription: "Advanced pattern recognition and risk controls.",
		accessType: "time_limited",
		validityDays: 90,
		ctaUrl: "https://app.bullhouse.com/courses/301",
		...overrides,
	};
}

describe("render-course-access-email", () => {
	it("renders course access granted email with time-limited summary", () => {
		const result = renderCourseAccessGranted(createCourseContext());

		expect(result.subject).toBe(
			"Course Access Granted - NEPSE Technical Analysis",
		);
		expect(result.previewText).toContain("NEPSE Technical Analysis");
		expect(result.html).toContain("Course Access Granted");
		expect(result.html).toContain("NEPSE Technical Analysis");
		expect(result.html).toContain("Access valid for 90 days.");
		expect(result.text).toContain("Access: Access valid for 90 days.");
		expect(result.text).toContain(
			"Start Course: https://app.bullhouse.com/courses/301",
		);
	});

	it("renders lifetime access summary when accessType is lifetime", () => {
		const result = renderCourseAccessGranted(
			createCourseContext({ accessType: "lifetime", validityDays: undefined }),
		);

		expect(result.text).toContain(
			"Access: You have lifetime access to this course.",
		);
	});

	it("renders successfully when finalPayable is zero", () => {
		const result = renderCourseAccessGranted(
			createCourseContext({
				finalPayable: 0,
			}),
		);

		expect(result.subject).toContain("Course Access Granted");
		expect(result.text).toContain("Start Course:");
	});
});

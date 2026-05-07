import { faker } from "@faker-js/faker";
import { v7 as uuidv7 } from "uuid";

faker.seed(12345);

export const randomId = () => uuidv7();
export const randomCode = (len = 8) =>
	faker.string.alphanumeric(len).toUpperCase();

export const randomInt = (min: number, max: number) =>
	faker.number.int({ min, max });
export const randomDecimal = (min: number, max: number) =>
	faker.number.float({ min, max, fractionDigits: 2 }).toFixed(2);
export const randomDecimal4 = (min: number, max: number) =>
	faker.number.float({ min, max, fractionDigits: 4 }).toFixed(4);

export const randomName = () => faker.person.fullName();
export const randomEmail = (prefix?: string) =>
	prefix ? `${prefix}@bullhouse.com` : faker.internet.email();
export const randomPhone = () => {
	const random8Digits = faker.string.numeric({ length: 8 });
	return `+97798${random8Digits}`;
};
export const randomText = (sentences = 2) => faker.lorem.sentences(sentences);

export const now = new Date();
export const timestamps = () => ({ createdAt: now, updatedAt: now });

export const daysAgo = (days: number) =>
	new Date(now.getTime() - days * 86400000);
export const daysFromNow = (days: number) =>
	new Date(now.getTime() + days * 86400000);
export const randomPastDate = (maxDays = 180) => daysAgo(randomInt(1, maxDays));
export const randomFutureDate = (minDays = 7, maxDays = 180) =>
	daysFromNow(randomInt(minDays, maxDays));

export const randomRating = () =>
	(Math.round(faker.number.float({ min: 3, max: 5 }) * 2) / 2).toFixed(1);
export const randomReview = () => faker.lorem.sentences({ min: 1, max: 3 });

export const pickOne = <T>(items: T[]): T => faker.helpers.arrayElement(items);
export const pickMany = <T>(items: T[], count: number): T[] =>
	faker.helpers.arrayElements(items, count);
export const randomBool = (probability = 0.5) =>
	faker.datatype.boolean({ probability });

export interface PriceRange {
	minMrp: number;
	maxMrp: number;
	discountMin: number;
	discountMax: number;
}

export const NPR_PRICE_RANGES = {
	course: { minMrp: 2000, maxMrp: 25000, discountMin: 10, discountMax: 35 },
	training: { minMrp: 5000, maxMrp: 50000, discountMin: 15, discountMax: 40 },
	digital_book: { minMrp: 500, maxMrp: 3000, discountMin: 20, discountMax: 50 },
	market_content: {
		minMrp: 500,
		maxMrp: 5000,
		discountMin: 10,
		discountMax: 30,
	},
	newsletter_access: {
		minMrp: 3000,
		maxMrp: 8000,
		discountMin: 15,
		discountMax: 35,
	},
} as const satisfies Record<string, PriceRange>;

export interface PriceResult {
	mrp: number;
	sp: number;
	discountPercent: number;
}

export const generatePrice = (
	productType: keyof typeof NPR_PRICE_RANGES,
): PriceResult => {
	const range = NPR_PRICE_RANGES[productType];
	const mrp = randomInt(range.minMrp, range.maxMrp);
	const discountPercent = randomInt(range.discountMin, range.discountMax);
	const sp = Math.round(mrp * (1 - discountPercent / 100));
	return { mrp, sp, discountPercent };
};

export { faker };

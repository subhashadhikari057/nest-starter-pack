import {
	type App,
	cert,
	getApps,
	initializeApp,
	type ServiceAccount,
} from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

export type { App, Messaging, ServiceAccount };

export const createFirebaseApp = (
	config: ServiceAccount,
	appName = "bullhouse-firebase",
): App => {
	const existingApps = getApps();
	const foundApp = existingApps.find((app) => app.name === appName);

	if (foundApp) {
		return foundApp;
	}

	return initializeApp(
		{
			credential: cert(config),
		},
		appName,
	);
};

export const createMessagingClient = (app: App): Messaging => {
	return getMessaging(app);
};

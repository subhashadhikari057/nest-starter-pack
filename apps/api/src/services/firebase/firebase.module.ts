import { createFirebaseApp, createMessagingClient } from "@bullhouse/firebase";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export const FIREBASE_MESSAGING = "FIREBASE_MESSAGING";

@Global()
@Module({
	providers: [
		{
			provide: FIREBASE_MESSAGING,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const firebaseConfig = {
					projectId: configService.getOrThrow<string>("FIREBASE_PROJECT_ID"),
					clientEmail: configService.getOrThrow<string>(
						"FIREBASE_CLIENT_EMAIL",
					),
					privateKey: configService
						.getOrThrow<string>("FIREBASE_PRIVATE_KEY")
						.replace(/\\n/g, "\n"),
				};

				const app = createFirebaseApp(firebaseConfig);
				return createMessagingClient(app);
			},
		},
	],
	exports: [FIREBASE_MESSAGING],
})
export class FirebaseModule {}

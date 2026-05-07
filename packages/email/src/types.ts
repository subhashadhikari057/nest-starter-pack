import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { ReactElement } from "react";

export interface EmailSmtpAuthConfig {
	user: string;
	pass: string;
}

export interface EmailSmtpConfig {
	host: string;
	port: number;
	secure?: boolean;
	auth?: EmailSmtpAuthConfig;
	from?: string;
}

export interface EmailClientOptions {
	smtp?: EmailSmtpConfig | null;
	defaultFrom?: string;
	logger?: EmailDebugLogger;
}

export interface EmailMessage {
	to: string | string[];
	subject: string;
	html?: string;
	text?: string;
	react?: ReactElement | null;
	previewText?: string;
	cc?: string | string[];
	bcc?: string | string[];
	from?: string;
	attachments?: SMTPTransport.Attachment[];
}

export interface EmailMessageResolved {
	to: string[];
	cc: string[];
	bcc: string[];
	subject: string;
	html?: string;
	text?: string;
	previewText?: string;
	from: string;
	attachments?: SMTPTransport.Attachment[];
}

export interface EmailSendResult {
	id?: string;
	accepted?: string[] | false;
	rejected?: string[] | false;
	response?: string;
	mocked: boolean;
	payload: EmailMessageResolved;
}

export type EmailDebugLogger = (payload: EmailMessageResolved) => void;

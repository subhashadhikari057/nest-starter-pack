import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";

import { Inter } from "next/font/google";

const inter = Inter({
	subsets: ["latin"],
});

export const metadata = {
	title: "bullhouse Docs",
	description: "Developer as well as business user documentation for bullhouse",
	metadataBase: new URL("https://docs.bullhouseinvestment.com"),
};
export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" className={inter.className} suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				<RootProvider>{children}</RootProvider>
			</body>
		</html>
	);
}

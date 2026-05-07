import {
	BookOpen,
	Code2,
	Database,
	FileCode,
	Layers,
	Network,
	Rocket,
	Server,
	Workflow,
} from "lucide-react";
import Link from "next/link";

const docSections = [
	{
		title: "Getting Started",
		description: "Setup your development environment and run your first build",
		href: "/docs",
		icon: Rocket,
	},
	{
		title: "API Development",
		description: "Backend patterns, NestJS modules, and API design guidelines",
		href: "/docs/developer/1.API_DEVELOPMENT_PLAYBOOK",
		icon: Server,
	},
	{
		title: "Frontend Guides",
		description: "Data fetching, forms, and React Query patterns",
		href: "/docs/developer/frontend/SSR_CSR_DATA_FETCHING",
		icon: Code2,
	},
	{
		title: "Database & ORM",
		description: "Drizzle ORM setup, migrations, and schema design",
		href: "/docs/developer/DATABASE_SETUP",
		icon: Database,
	},
	{
		title: "Real-time Events",
		description: "WebSocket architecture, rooms, and event handling",
		href: "/docs/developer/websocket/realtime-architecture",
		icon: Network,
	},
	{
		title: "Workflows",
		description: "Business logic flows for catalog, promotions, and more",
		href: "/docs/workflows/catalog",
		icon: Workflow,
	},
];

const quickLinks = [
	{ label: "Catalog Workflows", href: "/docs/workflows/catalog" },
	{
		label: "Product Variants",
		href: "/docs/developer/PRODUCT_VARIANTS_AND_DISCOUNTS",
	},
	{ label: "Cart & Checkout", href: "/docs/developer/checkout" },
	{ label: "Role Permissions", href: "/docs/developer/ROLE_PERMISSIONS_SETUP" },
	{ label: "Promotions", href: "/docs/developer/promotions" },
	{ label: "Storage", href: "/docs/developer/storage" },
];

const techStack = [
	{ name: "React 19", category: "Frontend" },
	{ name: "NestJS", category: "Backend" },
	{ name: "Drizzle ORM", category: "Database" },
	{ name: "PostgreSQL", category: "Database" },
	{ name: "TanStack Router", category: "Frontend" },
	{ name: "TanStack Query", category: "Frontend" },
	{ name: "Turborepo", category: "Tooling" },
	{ name: "TypeScript", category: "Language" },
];

export default function HomePage() {
	return (
		<main className="flex flex-1 flex-col">
			<section className="border-b bg-fd-background/50 px-6 py-16 md:py-24">
				<div className="mx-auto max-w-5xl">
					<div className="flex items-center gap-2 font-medium text-fd-muted-foreground text-sm">
						<FileCode className="size-4" />
						<span>Developer Documentation</span>
					</div>
					<h1 className="mt-4 font-bold text-4xl tracking-tight md:text-5xl">
						bullhouse Platform
					</h1>
					<p className="mt-4 max-w-2xl text-fd-muted-foreground text-lg">
						A full-stack TypeScript monorepo for building modern e-commerce
						applications. React 19, NestJS, Drizzle ORM, and PostgreSQL —
						managed with Turborepo.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<Link
							href="/docs"
							className="inline-flex items-center gap-2 rounded-md bg-fd-primary px-4 py-2 font-medium text-fd-primary-foreground text-sm transition-colors hover:bg-fd-primary/90"
						>
							<BookOpen className="size-4" />
							Read the Docs
						</Link>
						<Link
							href="/docs/developer/1.API_DEVELOPMENT_PLAYBOOK"
							className="inline-flex items-center gap-2 rounded-md border border-fd-border bg-fd-background px-4 py-2 font-medium text-sm transition-colors hover:bg-fd-accent"
						>
							<Layers className="size-4" />
							API Playbook
						</Link>
					</div>
				</div>
			</section>

			<section className="px-6 py-16">
				<div className="mx-auto max-w-5xl">
					<h2 className="font-medium text-fd-muted-foreground text-sm uppercase tracking-wide">
						Documentation
					</h2>
					<p className="mt-2 font-semibold text-2xl">Explore by topic</p>
					<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{docSections.map((section) => (
							<Link
								key={section.href}
								href={section.href}
								className="group relative rounded-lg border border-fd-border bg-fd-card p-5 transition-all hover:border-fd-primary/50 hover:shadow-sm"
							>
								<div className="mb-3 inline-flex rounded-md border border-fd-border bg-fd-background p-2">
									<section.icon className="size-5 text-fd-muted-foreground transition-colors group-hover:text-fd-primary" />
								</div>
								<h3 className="font-semibold">{section.title}</h3>
								<p className="mt-1 text-fd-muted-foreground text-sm">
									{section.description}
								</p>
							</Link>
						))}
					</div>
				</div>
			</section>

			<section className="border-t bg-fd-background/50 px-6 py-16">
				<div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2">
					<div>
						<h2 className="font-medium text-fd-muted-foreground text-sm uppercase tracking-wide">
							Quick Links
						</h2>
						<p className="mt-2 font-semibold text-xl">Popular guides</p>
						<ul className="mt-6 space-y-2">
							{quickLinks.map((link) => (
								<li key={link.href}>
									<Link
										href={link.href}
										className="inline-flex items-center text-fd-muted-foreground text-sm transition-colors hover:text-fd-foreground"
									>
										<span className="mr-2 text-fd-primary">→</span>
										{link.label}
									</Link>
								</li>
							))}
						</ul>
					</div>

					<div>
						<h2 className="font-medium text-fd-muted-foreground text-sm uppercase tracking-wide">
							Built With
						</h2>
						<p className="mt-2 font-semibold text-xl">Technology stack</p>
						<div className="mt-6 flex flex-wrap gap-2">
							{techStack.map((tech) => (
								<span
									key={tech.name}
									className="inline-flex items-center rounded-full border border-fd-border bg-fd-card px-3 py-1 font-medium text-xs"
								>
									{tech.name}
								</span>
							))}
						</div>
					</div>
				</div>
			</section>

			<section className="border-t px-6 py-16">
				<div className="mx-auto max-w-5xl">
					<h2 className="font-medium text-fd-muted-foreground text-sm uppercase tracking-wide">
						Quick Start
					</h2>
					<p className="mt-2 font-semibold text-2xl">Get running in minutes</p>
					<div className="mt-8 overflow-hidden rounded-lg border border-fd-border bg-fd-card">
						<div className="border-fd-border border-b bg-fd-background px-4 py-2">
							<span className="font-medium text-fd-muted-foreground text-xs">
								Terminal
							</span>
						</div>
						<pre className="overflow-x-auto p-4 text-sm">
							<code className="text-fd-muted-foreground">
								<span className="text-fd-foreground"># Clone and install</span>
								{"\n"}git clone https://github.com/bullhouse/bullhouse.git{"\n"}
								cd bullhouse
								{"\n"}pnpm install{"\n"}
								{"\n"}
								<span className="text-fd-foreground"># Setup database</span>
								{"\n"}pnpm db:start{"\n"}pnpm db:migrate{"\n"}
								{"\n"}
								<span className="text-fd-foreground"># Start development</span>
								{"\n"}pnpm dev
							</code>
						</pre>
					</div>
					<p className="mt-4 text-fd-muted-foreground text-sm">
						See the{" "}
						<Link href="/docs" className="underline hover:text-fd-foreground">
							full setup guide
						</Link>{" "}
						for environment configuration and troubleshooting.
					</p>
				</div>
			</section>
		</main>
	);
}

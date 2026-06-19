// Vortex Innovations - Global Application Data Storage
const SERVICES = [
  {
    id: "digital-strategy",
    title: "Digital Transformation & Strategy",
    description: "Re-engineer your business processes with custom cloud-focused technology and product roadmaps.",
    longDescription: "We partner with forward-thinking enterprises to design and execute digital solutions that maximize operational resilience. Our consultants analyze existing frameworks and formulate high-yield blueprints spanning cloud migration, automation, and tech stack upgrades.",
    icon: "compass",
    benefits: [
      "Improve operational efficiency by up to 40%",
      "Scalable infrastructure architecture blueprinting",
      "Comprehensive digital maturity auditing",
      "Risk assessment and software modernizations"
    ],
    priceRange: "Custom / Project-based",
    category: "Strategy"
  },
  {
    id: "app-development",
    title: "Full-Stack Custom App Development",
    description: "Design and program scalable, high-performance web applications and enterprise products.",
    longDescription: "Our skilled software engineers build bespoke, reliable web and native cloud platforms using cutting-edge technologies like React, Node.js, and modern serverless APIs. We prioritize responsive behavior, strict type-safety, and beautiful user experience.",
    icon: "code",
    benefits: [
      "Engineered for highly concurrent enterprise workflows",
      "Optimized for high-speed responsiveness and load speeds",
      "Robust state control and API synchronization",
      "Full coverage maintenance and ongoing updates"
    ],
    priceRange: "$85k - $150k",
    category: "Technology"
  },
  {
    id: "ai-solutions",
    title: "Artificial Intelligence & Data Analytics",
    description: "Leverage intelligent search, automated classification, and predictive insight modeling.",
    longDescription: "Harness modern cognitive networks to gain unparalleled clarity. We implement intelligent analytics algorithms, automate content generation, draft vector embeddings databases, and configure data pipelines to turn metrics into active choices.",
    icon: "brain-circuit",
    benefits: [
      "Custom machine learning models tuned to niche sectors",
      "Natural language summary pipelines",
      "Automated document synthesis and processing",
      "Predictive revenue and operational forecasts"
    ],
    priceRange: "$120k - $240k",
    category: "Technology"
  },
  {
    id: "ui-ux-design",
    title: "User Experience (UX) & Brand Studio",
    description: "Create striking interactive layouts, consistent web design languages, and product designs.",
    longDescription: "Design is not just what it looks like; it is how it acts. Our creators construct detailed wireframes, perform user usability interviews, build interactive clickable mockups, and layout polished design languages that drive metric gains.",
    icon: "layers",
    benefits: [
      "Interactive high-fidelity wireframes and design systems",
      "In-depth customer usability journey reports",
      "Vibrant responsive web interfaces and design sheets",
      "Dynamic hover transitions and delightful interactions"
    ],
    priceRange: "$35k - $75k",
    category: "Design"
  },
  {
    id: "growth-marketing",
    title: "Performance growth & SEO Strategy",
    description: "Scale organic customer acquisition with advanced keyword analytics and data campaigns.",
    longDescription: "Optimize customer touch points to accelerate customer conversion rates. We formulate content marketing frameworks, perform search visibility optimization, and run data-driven analytical retargeting that maximizes marketing ROI.",
    icon: "trending-up",
    benefits: [
      "Data-backed search engine ranking improvements",
      "Custom content production schedules and copy writing",
      "Conversion rate optimization (CRO) testing setups",
      "Automated user onboarding funnels and campaigns"
    ],
    priceRange: "$5k - $15k / mo",
    category: "Marketing"
  },
  {
    id: "cloud-security",
    title: "Enterprise Cloud Optimization",
    description: "Architect robust multi-region clouds with state-of-the-art server protections and containerization.",
    longDescription: "Maximize server performance while minimizing resource spends. We structure custom cloud container systems using Docker, Kubernetes, and automated CI/CD deployments that maintain 99.99% availability bounds.",
    icon: "shield-check",
    benefits: [
      "Up to 50% decrease in cloud host server bills",
      "Instant continuous integration and deployment pipelines",
      "Strict data leak and authorization audits",
      "Automated regular failover setup and daily backups"
    ],
    priceRange: "$60k - $110k",
    category: "Technology"
  }
];

const BLOG_POSTS = [
  {
    id: "future-of-cloud",
    title: "Decentralized & Serverless: The Future of Enterprise Architecture",
    summary: "How modern industries are restructuring complex server rooms to cloud serverless architectures to reduce cost and minimize platform latency.",
    content: "The landscape of cloud infrastructure is undergoing a radical transition. Traditional load-balancing setups and dedicated server arrays are rapidly yielding to fully managed serverless architectures. This dramatic shift is driven by a singular business imperative: the need for agile, self-scaling operations that calculate pricing strictly per-second of activity.\n\nIn this analytical guide, we explore the mechanical advantages of serverless computing, outline the top migration pitfalls experienced by Fortune 500 engineering groups, and dissect real-world strategies for keeping latency under 50 milliseconds across global CDNs.\n\n### Why Serverless is No Longer Optional\n\nFor decades, computing was bounded by peak capacity provisioning. Teams had to purchase and run oversized servers to guarantee system availability during high-traffic quarters. Consequently, average system CPU utilization sat below 15%, resulting in millions of dollars of idle server costs.\n\nServerless removes this baseline. Under a true event-driven serverless topology, assets exist in cold sleep and spin up inside active containers within milliseconds of a network router request. When active traffic declines to zero, your billing drops precisely to zero.",
    image: "https://picsum.photos/seed/future-cloud/800/450",
    category: "Technology",
    author: {
      name: "Marcus Vance",
      role: "VP of Enterprise Cloud Architecture",
      avatar: "https://picsum.photos/seed/marcus/120/120"
    },
    readTime: "6 min read",
    date: "June 14, 2026",
    featured: true
  },
  {
    id: "design-systems-scale",
    title: "Unifying Brand Design Systems Across Distributed Product Teams",
    summary: "Dissecting how structured layout paradigms, typographic tokens, and Tailwind classes accelerate feature sprint velocities.",
    content: "When engineering teams expand from ten members to a hundred, aesthetic continuity is often the first casualty. Individual squads begin adding customized colors, modifying button margins, and introducing unapproved icons to speed up localized feature deliveries.\n\nThe cure for design drift is a systematic, centralized single source of truth: a Component Design System. By translating abstract visual aesthetics into standardized, composable code tokens, businesses lock down consistent rendering while boosting software release timelines.",
    image: "https://picsum.photos/seed/design-systems/800/450",
    category: "Design",
    author: {
      name: "Sophia Chen",
      role: "Design Director & Brand Principal",
      avatar: "https://picsum.photos/seed/sophia/120/120"
    },
    readTime: "8 min read",
    date: "May 28, 2026",
    featured: false
  },
  {
    id: "seo-algorithms",
    title: "Demystifying Modern Search Engine Ranking Algorithms in 2026",
    summary: "Deep dive into real-user engagement tracking, document vector relevance, and programmatic accessibility parameters.",
    content: "Search index matching is no longer about keyword repetition or artificial backlink networks. Modern crawling engines use deep cognitive neural pathways to weigh semantic query matches and real-time interaction metrics.\n\nIn this article, we outline the exact mechanics of document relevance scoring, and provide an actionable strategy for structuring business blogs and homepages to index beautifully on top search engines.",
    image: "https://picsum.photos/seed/seo-ranking/800/450",
    category: "Marketing",
    author: {
      name: "Elena Rostova",
      role: "Principal Acquisition Strategist",
      avatar: "https://picsum.photos/seed/elena/120/120"
    },
    readTime: "5 min read",
    date: "April 19, 2026",
    featured: false
  },
  {
    id: "ai-efficiency-impact",
    title: "Harnessing Narrow AI for Corporate Knowledge Base Search",
    summary: "How enterprises are leveraging semantic search vectors and local storage archives to streamline internal knowledge discoverability.",
    content: "The typical corporate worker spends over an hour daily matching files across daily servers, chat lines, and emails. By implementing local semantic search layers, businesses consolidate unstructured documents into a rapid interactive knowledge archive.",
    image: "https://picsum.photos/seed/ai-knowledge/800/450",
    category: "Innovation",
    author: {
      name: "Dr. Arthur Pendelton",
      role: "Director of Cognitive Systems Lab",
      avatar: "https://picsum.photos/seed/arthur/120/120"
    },
    readTime: "10 min read",
    date: "March 11, 2026",
    featured: false
  }
];

const TEAM_MEMBERS = [
  {
    name: "Elena Rostova",
    role: "CEO & Co-Founder",
    bio: "Ex-strategy leader with 15+ years formulating enterprise strategy and raising digital adoption benchmarks worldwide.",
    avatar: "https://picsum.photos/seed/elena_avatar/300/300",
    socials: { twitter: "https://twitter.com", linkedin: "https://linkedin.com" }
  },
  {
    name: "Marcus Vance",
    role: "Chief Technology Officer",
    bio: "Passionate about cloud orchestration, serverless execution parameters, and type-safe systems. Ex-Google Cloud engineering lead.",
    avatar: "https://picsum.photos/seed/marcus_avatar/300/300",
    socials: { linkedin: "https://linkedin.com", github: "https://github.com" }
  },
  {
    name: "Sophia Chen",
    role: "Director of UX & Design Systems",
    bio: "Believer in visual alignment and typographic systems. Has crafted software interfaces accessed by over 50M global consumers.",
    avatar: "https://picsum.photos/seed/sophia_avatar/300/300",
    socials: { twitter: "https://twitter.com", linkedin: "https://linkedin.com" }
  },
  {
    name: "Devon Reynolds",
    role: "Head of Growth & Performance Marketing",
    bio: "Masters in behavioral economics and marketing search tracking. Helping enterprises find scalable channels to boost customer acquisitions.",
    avatar: "https://picsum.photos/seed/devon_avatar/300/300",
    socials: { twitter: "https://twitter.com", linkedin: "https://linkedin.com", github: "https://github.com" }
  }
];

const ACHIEVEMENTS = [
  {
    number: "350+",
    label: "Digital Launches",
    description: "Successfully shipped complete web systems, product structures, and performance growth funnels for international brands."
  },
  {
    number: "45%",
    label: "Avg. Velocity Boost",
    description: "Our engineered software frameworks and cloud setups optimize delivery timelines for in-house developer squads."
  },
  {
    number: "99.9%",
    label: "Continuous Uptime",
    description: "Ensured bulletproof infrastructure reliability and failovers on top-tier cloud providers."
  },
  {
    number: "50M+",
    label: "Acted Reach",
    description: "User interfaces designed by our brand studio handle massive monthly active consumer click throughs."
  }
];

const FAQS = [
  {
    id: "faq-1",
    question: "What industries do you typically partner with?",
    answer: "We partner primarily with fast-growing technical enterprises, digital scale-ups, modern retail corporations, and healthcare companies seeking custom, high-durability digital transformations.",
    category: "General"
  },
  {
    id: "faq-2",
    question: "Do you offer post-launch maintenance packages?",
    answer: "Yes, we structure dedicated Service Level Agreements (SLAs) ranging from standard bug patrols to high-frequency live uptime tracking, security updates, and performance optimizations.",
    category: "Services"
  },
  {
    id: "faq-3",
    question: "How long does a typical full-stack prototype build require?",
    answer: "Our standard full-stack enterprise applications move from strategy wireframes to active beta container launch within 8 to 12 weeks depending on complexity.",
    category: "Services"
  },
  {
    id: "faq-4",
    question: "How do we handle intellectual property (IP) transfers?",
    answer: "All intellectual property, software source repositories, design system components, and assets belong entirely to you upon invoice settlement. Standard transfers are explicitly drafted in our contract agreements.",
    category: "Billing"
  },
  {
    id: "faq-5",
    question: "Do you integrate with pre-existing legacy backends?",
    answer: "Frequently. We build customized, secure middleware proxy microservices that safely hook into legacy SQL structures, mainframes, or private servers to securely expose pristine API interfaces to modern React applications.",
    category: "General"
  }
];

const TESTIMONIALS = [
  {
    quote: "Vortex streamlined our entire inventory management pipeline. Our cloud bills decreased by 40% while active API latency went down to 12ms. Truly a tier-one digital partner.",
    author: "Regina Hale",
    role: "Director of Technology, BioScience Intl",
    avatar: "https://picsum.photos/seed/regina/120/120"
  },
  {
    quote: "The brand studio designed a uniform visual design system that unified our three distinct product squads. Our velocity accelerated almost instantly within the first sprint.",
    author: "Douglas Vance",
    role: "VP of Product Development, Finly Inc",
    avatar: "https://picsum.photos/seed/douglas/120/120"
  },
  {
    quote: "Incredible attention to detail, typesafe setups, and bulletproof deployment channels. They don't just deliver mock code; they build production-grade architectures.",
    author: "Sandra Kim",
    role: "Co-Founder & COO, Apex Growth",
    avatar: "https://picsum.photos/seed/sandra/120/120"
  }
];

// Attach variables to window so they are globally available
window.SERVICES = SERVICES;
window.BLOG_POSTS = BLOG_POSTS;
window.TEAM_MEMBERS = TEAM_MEMBERS;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.FAQS = FAQS;
window.TESTIMONIALS = TESTIMONIALS;

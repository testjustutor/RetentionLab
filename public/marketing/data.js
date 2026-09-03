/**
 * public/marketing/data.js
 */

const SERVICES = [
  {
    id: "meeting-intelligence",
    title: "AI Meeting Intelligence",
    description: "Automated meeting summaries and action items powered by advanced AI.",
    longDescription: "RetentionLab's AI engine processes meeting recordings and live captions to generate comprehensive summaries, extract action items, and provide OQI (Overall Quality Index) scores. Never miss a critical detail from any meeting.",
    icon: "brain-circuit",
    benefits: [
      "AI-generated meeting summaries with key insights",
      "Automatic action item extraction and tracking",
      "OQI scoring for meeting quality assessment"
    ],
    priceRange: "Included in Pro plan",
    category: "AI"
  },
  {
    id: "calendar-sync",
    title: "Smart Calendar Integration",
    description: "Seamless Google Calendar sync with automatic meeting detection and bot scheduling.",
    longDescription: "Connect your Google Calendar and RetentionLab automatically detects upcoming meetings, joins them via bot, and begins recording and transcribing. Supports Google Meet, Zoom, and Microsoft Teams.",
    icon: "calendar",
    benefits: [
      "Automatic meeting detection from calendar events",
      "Multi-platform support (Google Meet, Zoom, Teams)",
      "Bot auto-joins scheduled meetings",
      "Real-time captions and transcription"
    ],
    priceRange: "Free with all plans",
    category: "Integration"
  },
  {
    id: "transcript-storage",
    title: "Secure Transcript Management",
    description: "Centralized storage for all meeting transcripts with powerful search and export capabilities.",
    longDescription: "Every meeting transcript is securely stored and indexed. Search across all transcripts, export in multiple formats, and maintain a complete historical record of all organizational communications.",
    icon: "file-text",
    benefits: [
      "Centralized transcript repository",
      "Full-text search across all meetings",
      "Multiple export formats (TXT, JSON, SRT)",
      "Secure encrypted storage"
    ],
    priceRange: "Included in all plans",
    category: "Storage"
  },
  {
    id: "instructor-dashboard",
    title: "Instructor Performance Dashboard",
    description: "Comprehensive analytics dashboard for instructors with session reviews and quality metrics.",
    longDescription: "Instructors get a personalized dashboard showing their meeting history, OQI scores, session recordings, and detailed analytics. Track improvement over time with data-driven insights.",
    icon: "bar-chart-3",
    benefits: [
      "Personalized performance metrics",
      "Session recording playback",
      "OQI score tracking over time",
      "Detailed session analytics and reports"
    ],
    priceRange: "Included in Pro plan",
    category: "Analytics"
  },
  {
    id: "reviewer-system",
    title: "Peer Review & Evaluation System",
    description: "Structured peer review workflows with rubrics, scoring, and actionable feedback.",
    longDescription: "Enable peer-to-peer session reviews with customizable rubrics, scoring criteria, and structured feedback. Reviewers can assess sessions, provide coaching feedback, and track improvement over time.",
    icon: "users",
    benefits: [
      "Customizable review rubrics",
      "Structured scoring and feedback",
      "Reviewer assignment and scheduling",
      "Progress tracking and improvement metrics"
    ],
    priceRange: "Team plan feature",
    category: "Collaboration"
  },
  {
    id: "quality-analytics",
    title: "Session Quality Analytics",
    description: "Deep analytics on session quality, participant engagement, and teaching effectiveness.",
    longDescription: "Advanced analytics engine that evaluates session quality across multiple dimensions including talk ratio, sentiment analysis, question frequency, and student engagement metrics.",
    icon: "line-chart",
    benefits: [
      "Talk ratio and participation analysis",
      "Sentiment and engagement tracking",
      "Question frequency and quality metrics",
      "Automated quality reports and recommendations"
    ],
    priceRange: "Enterprise plan feature",
    category: "Analytics"
  },
  {
    id: "real-time-captions",
    title: "Real-Time Live Captions",
    description: "Live captions and transcription during meetings with speaker identification.",
    longDescription: "Get real-time captions during your meetings with advanced speaker diarization. Perfect for accessibility, note-taking, and ensuring no important information is missed.",
    icon: "mic",
    benefits: [
      "Real-time transcription",
      "Speaker identification",
      "Multi-language support",
      "Accessibility compliant"
    ],
    priceRange: "Included in all plans",
    category: "AI"
  },
  {
    id: "action-items",
    title: "Smart Action Items",
    description: "Automatically extract and track action items from meetings with AI.",
    longDescription: "Our AI automatically identifies action items, assigns owners, sets deadlines, and tracks completion. Never let important tasks fall through the cracks again.",
    icon: "check-circle",
    benefits: [
      "Automatic action item extraction",
      "Owner assignment and tracking",
      "Deadline management",
      "Integration with task management tools"
    ],
    priceRange: "Pro plan feature",
    category: "AI"
  }
];

// ==========================================
// ACHIEVEMENTS / METRICS
// ==========================================

const ACHIEVEMENTS = [
  {
    number: "10K+",
    label: "Meetings Analyzed",
    description: "Successfully processed and analyzed thousands of educational and business meetings."
  },
  {
    number: "98%",
    label: "Transcription Accuracy",
    description: "Industry-leading AI transcription accuracy across multiple languages and accents."
  },
  {
    number: "99.9%",
    label: "Platform Uptime",
    description: "Enterprise-grade infrastructure ensuring reliable 24/7 availability."
  },
  {
    number: "500+",
    label: "Active Teams",
    description: "Trusted by hundreds of educational institutions and corporate teams worldwide."
  },
  {
    number: "50+",
    label: "Countries Served",
    description: "Global reach with support for multiple languages and time zones."
  },
  {
    number: "24/7",
    label: "Customer Support",
    description: "Round-the-clock support to ensure your success with our platform."
  },
  {
    number: "150+",
    label: "Integrations",
    description: "Seamlessly connects with your favorite tools and platforms."
  },
  {
    number: "4.9/5",
    label: "Customer Rating",
    description: "Highly rated by users for ease of use and powerful features."
  }
];

// ==========================================
// TESTIMONIALS
// ==========================================

const TESTIMONIALS = [
  {
    quote: "RetentionLab transformed how we review our tutoring sessions. The AI summaries save hours of manual note-taking, and the OQI scores give us objective quality metrics we never had before.",
    author: "Dr. Sarah Mitchell",
    role: "Academic Director, Premier Tutoring",
    avatar: "https://picsum.photos/seed/sarah/120/120"
  },
  {
    quote: "The calendar integration is seamless. Our instructors don't have to think about recording — the bot just joins and captures everything automatically. It's set-and-forget.",
    author: "James Chen",
    role: "VP of Operations, LearnFast Inc",
    avatar: "https://picsum.photos/seed/james/120/120"
  },
  {
    quote: "The peer review system with rubrics has completely standardized our quality assurance process. We can now track instructor improvement with actual data, not just gut feelings.",
    author: "Maria Rodriguez",
    role: "Quality Assurance Lead, EduPro Services",
    avatar: "https://picsum.photos/seed/maria/120/120"
  },
  {
    quote: "We've reduced our meeting follow-up time by 70%. The AI summaries are incredibly accurate and the action item tracking ensures nothing gets missed.",
    author: "David Park",
    role: "CEO, TechStart Solutions",
    avatar: "https://picsum.photos/seed/david/120/120"
  },
  {
    quote: "The analytics dashboard gives us insights we never had before. We can now identify patterns in our meetings and continuously improve our communication.",
    author: "Emily Watson",
    role: "Training Manager, Global Corp",
    avatar: "https://picsum.photos/seed/emily/120/120"
  }
];

// ==========================================
// FEATURES
// ==========================================

const FEATURES = [
  {
    icon: "bot",
    title: "Automated Bot Recording",
    description: "Bots automatically join scheduled meetings to record, transcribe, and analyze sessions in real-time."
  },
  {
    icon: "sparkles",
    title: "AI-Powered Summaries",
    description: "Get concise, accurate meeting summaries with key points, action items, and decisions highlighted."
  },
  {
    icon: "search",
    title: "Full-Text Search",
    description: "Search across all transcripts, summaries, and notes to find exactly what you need instantly."
  },
  {
    icon: "shield",
    title: "Enterprise Security",
    description: "SOC 2 compliant infrastructure with encrypted storage, role-based access, and audit logging."
  },
  {
    icon: "layout-dashboard",
    title: "Role-Based Dashboards",
    description: "Customized views for admins, instructors, and reviewers with relevant metrics and tools."
  },
  {
    icon: "refresh-cw",
    title: "Real-Time Sync",
    description: "Automatic synchronization with Google Calendar ensures no meeting is ever missed."
  },
  {
    icon: "zap",
    title: "Lightning Fast Processing",
    description: "Advanced AI processes meetings in minutes, not hours. Get insights almost instantly."
  },
  {
    icon: "globe",
    title: "Multi-Language Support",
    description: "Support for 50+ languages with automatic detection and translation capabilities."
  }
];

// ==========================================
// FAQ
// ==========================================

const FAQS = [
  {
    id: "faq-1",
    question: "How does RetentionLab connect to my calendar?",
    answer: "Simply authorize your Google Calendar through our secure OAuth flow. RetentionLab will automatically detect upcoming meetings, identify the platform (Google Meet, Zoom, Teams), and schedule bots to join and record them.",
    category: "Setup"
  },
  {
    id: "faq-2",
    question: "What meeting platforms are supported?",
    answer: "RetentionLab supports Google Meet, Zoom, and Microsoft Teams. Our bot can join meetings on any of these platforms to record, transcribe, and analyze sessions.",
    category: "Platform"
  },
  {
    id: "faq-3",
    question: "How accurate is the AI transcription?",
    answer: "Our AI transcription engine achieves 98%+ accuracy across multiple languages and accents. We use advanced whisper models combined with speaker diarization to accurately attribute speech to each participant.",
    category: "AI"
  },
  {
    id: "faq-4",
    question: "Can I review and edit the AI-generated summaries?",
    answer: "Yes. All AI-generated content is editable. Reviewers and admins can refine summaries, adjust action items, and add notes. The system tracks all changes for accountability.",
    category: "Features"
  },
  {
    id: "faq-5",
    question: "How is my data secured?",
    answer: "All data is encrypted at rest and in transit. We use SOC 2 compliant infrastructure, role-based access control, and maintain comprehensive audit logs. You retain full ownership of your data.",
    category: "Security"
  },
  {
    id: "faq-6",
    question: "What is an OQI score?",
    answer: "OQI (Overall Quality Index) is our proprietary scoring system that evaluates meeting quality across multiple dimensions including engagement, clarity, participation balance, and effectiveness.",
    category: "Features"
  },
  {
    id: "faq-7",
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time with no cancellation fees. Your access will continue until the end of your billing period.",
    category: "Billing"
  },
  {
    id: "faq-8",
    question: "Do you offer custom enterprise solutions?",
    answer: "Absolutely! Our Enterprise plan includes custom integrations, dedicated support, SSO, and tailored solutions. Contact our sales team to discuss your specific needs.",
    category: "Enterprise"
  }
];

// ==========================================
// PRICING PLANS
// ==========================================

const PLANS = [
  {
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "Perfect for individual instructors and small teams getting started.",
    features: [
      "Up to 50 meetings/month",
      "AI-generated summaries",
      "Basic transcription",
      "7-day transcript storage",
      "Email support",
      "1 user account"
    ],
    cta: "Get Started",
    highlighted: false
  },
  {
    name: "Professional",
    price: "$79",
    period: "/month",
    description: "For growing teams that need advanced analytics and review workflows.",
    features: [
      "Up to 200 meetings/month",
      "Advanced AI summaries & OQI scoring",
      "Peer review system with rubrics",
      "90-day transcript storage",
      "Priority email & chat support",
      "Up to 10 user accounts",
      "Custom dashboard views",
      "API access"
    ],
    cta: "Start Free Trial",
    highlighted: true
  },
  {
    name: "Enterprise",
    price: "$199",
    period: "/month",
    description: "For organizations requiring full control, compliance, and customization.",
    features: [
      "Unlimited meetings",
      "All AI features + custom models",
      "Advanced analytics & reporting",
      "Unlimited transcript storage",
      "Dedicated account manager",
      "Unlimited user accounts",
      "SSO & custom integrations",
      "SLA guarantee",
      "On-premise deployment option"
    ],
    cta: "Contact Sales",
    highlighted: false
  }
];

// ==========================================
// ADDITIONAL STATS
// ==========================================

const STATS = [
  {
    icon: "clock",
    value: "70%",
    label: "Time Saved",
    description: "Average reduction in meeting follow-up time"
  },
  {
    icon: "trending-up",
    value: "45%",
    label: "Productivity Boost",
    description: "Increase in team productivity metrics"
  },
  {
    icon: "award",
    value: "95%",
    label: "Customer Satisfaction",
    description: "Users who would recommend RetentionLab"
  },
  {
    icon: "rocket",
    value: "3x",
    label: "Faster Insights",
    description: "Compared to manual meeting notes"
  }
];

// ==========================================
// EXPORT TO WINDOW
// ==========================================

window.SERVICES = SERVICES;
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.TESTIMONIALS = TESTIMONIALS;
window.FEATURES = FEATURES;
window.FAQS = FAQS;
window.PLANS = PLANS;
window.STATS = STATS;

console.log('RetentionLab marketing data loaded successfully');
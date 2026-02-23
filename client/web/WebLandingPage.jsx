import React, { useRef } from "react";
import {
  Github,
  Smartphone,
  Lock,
  CheckCircle,
  Bell,
  Fingerprint,
  Shield,
  Monitor,
  History,
  Key,
  Server,
  Trash2,
  Moon,
  Code2,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import { Layout } from "./components/Layout";
import { AppStoreButtons } from "./components/AppStoreButtons";
import { usePageTitle } from "../hooks/usePageTitle";
import { Card, CardContent, buttonVariants } from "@mieweb/ui";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

// --- Animation Variants ---
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay: i * 0.1,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      delay: i * 0.08,
      type: "spring",
      stiffness: 100,
    },
  }),
};

const slideInLeft = {
  hidden: { opacity: 0, x: -80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const slideInRight = {
  hidden: { opacity: 0, x: 80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// --- Reusable Section Wrapper ---
const Section = ({ children, className = "", ...props }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.section
      ref={ref}
      initial={shouldReduceMotion ? "visible" : "hidden"}
      animate={isInView ? "visible" : "hidden"}
      className={className}
      {...props}
    >
      {children}
    </motion.section>
  );
};

// --- Floating Badge ---
const FloatingBadge = ({ icon: Icon, label, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0, y: 20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{
      delay: 1.2 + delay,
      type: "spring",
      stiffness: 200,
      damping: 15,
    }}
    className={`absolute z-20 bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl px-4 py-3 hidden lg:flex items-center gap-2 ${className}`}
  >
    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
      <Icon className="w-4 h-4 text-blue-600" />
    </div>
    <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
      {label}
    </span>
  </motion.div>
);

// --- How-It-Works Step ---
const Step = ({ number, title, description, icon: Icon, index }) => (
  <motion.div
    variants={fadeUp}
    custom={index}
    className="relative flex flex-col items-center text-center group"
  >
    <motion.div
      whileHover={{ scale: 1.1, rotate: 5 }}
      className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-500/25"
    >
      <Icon className="w-9 h-9 text-white" />
    </motion.div>
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center mb-3">
      {number}
    </div>
    <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
  </motion.div>
);

// --- Feature Card ---
const FeatureCard = ({ icon: Icon, title, description, gradient, index }) => (
  <motion.div variants={scaleUp} custom={index}>
    <Card className="h-full border-0 shadow-md hover:shadow-xl transition-shadow duration-300 group overflow-hidden">
      <CardContent className="p-6">
        <motion.div
          whileHover={{ scale: 1.1, rotate: -5 }}
          className={`w-14 h-14 rounded-2xl ${gradient} flex items-center justify-center mb-5 shadow-lg`}
        >
          <Icon className="w-7 h-7 text-white" />
        </motion.div>
        <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </CardContent>
    </Card>
  </motion.div>
);

export const WebLandingPage = () => {
  usePageTitle(null); // Home page — use default title
  const shouldReduceMotion = useReducedMotion();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const features = [
    {
      icon: Fingerprint,
      title: "Biometric Authentication",
      description:
        "Face ID, Touch ID, and fingerprint login. Authenticate in milliseconds with the security of your own biology.",
      gradient:
        "bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/25",
    },
    {
      icon: Bell,
      title: "Push Notification 2FA",
      description:
        "Approve or reject login requests with a single tap. Real-time push notifications replace insecure SMS codes.",
      gradient:
        "bg-gradient-to-br from-orange-500 to-red-500 shadow-orange-500/25",
    },
    {
      icon: Smartphone,
      title: "Multi-Device Support",
      description:
        "Register multiple devices with primary/secondary designation. Cross-device approval keeps your accounts secure.",
      gradient:
        "bg-gradient-to-br from-cyan-500 to-blue-500 shadow-cyan-500/25",
    },
    {
      icon: History,
      title: "Notification History",
      description:
        "Full audit trail of every authentication request -- filterable, searchable, and paginated for complete visibility.",
      gradient:
        "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/25",
    },
    {
      icon: Key,
      title: "API Key Authentication",
      description:
        "Enterprise-grade PBKDF2-SHA512 hashed API keys with timing-safe comparison. Built for production workloads.",
      gradient:
        "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25",
    },
    {
      icon: Server,
      title: "Multi-Instance Scalable",
      description:
        "MongoDB-backed shared state enables horizontal scaling. No sticky sessions, no single points of failure.",
      gradient:
        "bg-gradient-to-br from-indigo-500 to-violet-500 shadow-indigo-500/25",
    },
    {
      icon: Shield,
      title: "Screen Lock Security",
      description:
        "Automatic session termination when your device locks. Re-authentication required on every resume.",
      gradient:
        "bg-gradient-to-br from-rose-500 to-pink-500 shadow-rose-500/25",
    },
    {
      icon: Trash2,
      title: "Account Deletion",
      description:
        "GDPR-ready self-service account deletion with 30-day processing, admin notification, and full data removal.",
      gradient:
        "bg-gradient-to-br from-slate-500 to-gray-600 shadow-slate-500/25",
    },
    {
      icon: Moon,
      title: "Dark Mode",
      description:
        "Toggle between light and dark themes with persistent preference. Easy on the eyes, day or night.",
      gradient:
        "bg-gradient-to-br from-gray-700 to-gray-900 shadow-gray-700/25",
    },
  ];

  const stats = [
    { value: "100%", label: "Open Source" },
    { value: "2", label: "Platforms" },
    { value: "< 1s", label: "Auth Speed" },
    { value: "100K", label: "PBKDF2 Iterations" },
  ];

  return (
    <Layout>
      {/* ===== HERO ===== */}
      <div
        ref={heroRef}
        className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950"
      >
        {/* Animated grid background */}
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"
          aria-hidden="true"
        />
        {/* Glow orbs */}
        <motion.div
          animate={
            shouldReduceMotion
              ? {}
              : { scale: [1, 1.2, 1], opacity: [0.15, 0.25, 0.15] }
          }
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[128px]"
          aria-hidden="true"
        />
        <motion.div
          animate={
            shouldReduceMotion
              ? {}
              : { scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }
          }
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-indigo-500 rounded-full blur-[128px]"
          aria-hidden="true"
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full"
        >
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center py-20 md:py-0">
            {/* Left: Text */}
            <div className="text-center md:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium px-4 py-1.5 rounded-full mb-8"
              >
                <Code2 className="w-4 h-4" />
                100% Open Source &amp; Free
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.15 }}
                className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.1] mb-6"
              >
                Authentication{" "}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                  reimagined.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="text-lg sm:text-xl text-gray-400 max-w-xl mx-auto md:mx-0 mb-10 leading-relaxed"
              >
                Biometric login, push notification 2FA, multi-device management,
                and a full audit trail — all in one open-source mobile app.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45 }}
                className="justify-center md:justify-start"
              >
                <AppStoreButtons
                  variant="light"
                  className="justify-center md:justify-start"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="mt-8 flex items-center gap-6 justify-center md:justify-start"
              >
                <a
                  href="https://github.com/mieweb/mieweb_auth_app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                >
                  <Github className="w-5 h-5" />
                  Star on GitHub
                </a>
                <a
                  href="/test-notification"
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors font-medium"
                >
                  Try it live
                  <ArrowRight className="w-4 h-4" />
                </a>
              </motion.div>
            </div>

            {/* Right: Phone Mockup */}
            <div
              className="relative flex items-center justify-center"
              aria-hidden="true"
            >
              <motion.div
                initial={{ opacity: 0, y: 60, rotateY: -15 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                className="relative z-10"
              >
                <div className="w-60 md:w-64 lg:w-72 h-[440px] md:h-[480px] lg:h-[520px] bg-gray-900 rounded-[3rem] border-[6px] border-gray-700 shadow-2xl shadow-blue-500/20 flex flex-col overflow-hidden relative">
                  {/* Notch */}
                  <div className="absolute top-0 w-full h-7 bg-gray-900 z-20 flex justify-center">
                    <div className="w-24 h-5 bg-black rounded-b-2xl" />
                  </div>
                  {/* Screen */}
                  <div className="flex-1 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
                    <div className="p-6 flex flex-col h-full">
                      <div className="mt-10 mb-6">
                        <motion.div
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-blue-500/30"
                        >
                          <img
                            src="/logo.png"
                            alt=""
                            width="40"
                            height="40"
                            className="w-10 h-10 brightness-0 invert"
                          />
                        </motion.div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Welcome Back
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Authenticate to continue
                        </p>
                      </div>

                      {/* Mock notification card */}
                      <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.5, duration: 0.5 }}
                        className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Bell className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-bold text-blue-700">
                            Login Request
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mb-3">
                          Approve sign-in from Chrome on Mac?
                        </p>
                        <div className="flex gap-2">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex-1 bg-emerald-500 text-white text-xs font-bold rounded-lg py-2 text-center cursor-pointer"
                          >
                            Approve
                          </motion.div>
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="flex-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg py-2 text-center cursor-pointer"
                          >
                            Reject
                          </motion.div>
                        </div>
                      </motion.div>

                      <div className="mt-auto flex justify-center gap-4">
                        <div className="w-12 h-12 border-2 border-blue-500 rounded-full flex items-center justify-center">
                          <Fingerprint className="w-6 h-6 text-blue-500" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating badges around phone */}
              <FloatingBadge
                icon={Lock}
                label="End-to-End Encrypted"
                delay={0}
                className="top-12 lg:-left-8 xl:-left-20"
              />
              <FloatingBadge
                icon={Fingerprint}
                label="Biometric Ready"
                delay={0.2}
                className="bottom-32 lg:-right-2 xl:-right-4 2xl:-right-20"
              />
              <FloatingBadge
                icon={CheckCircle}
                label="Approved!"
                delay={0.4}
                className="bottom-12 lg:-left-8"
              />
            </div>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-gray-500"
        >
          <ChevronDown className="w-6 h-6" />
        </motion.div>
      </div>

      {/* ===== STATS BAR ===== */}
      <Section className="relative -mt-16 z-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={fadeUp}
          className="bg-card rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-border grid grid-cols-2 md:grid-cols-4 divide-x divide-border"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={fadeUp}
              custom={i}
              className="p-6 sm:p-8 text-center"
            >
              <div className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* ===== HOW IT WORKS ===== */}
      <Section
        className="py-24 lg:py-32 bg-background overflow-hidden"
        variants={staggerContainer}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} className="text-center mb-16 lg:mb-20">
            <span className="text-sm font-bold text-primary tracking-widest uppercase">
              How It Works
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              Three steps to{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                zero-friction auth
              </span>
            </h2>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="grid md:grid-cols-3 gap-8 lg:gap-12 relative"
          >
            {/* Connecting line */}
            <div className="hidden md:block absolute top-10 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
            <Step
              number={1}
              icon={Smartphone}
              title="Install & Register"
              description="Download MIEAuth on iOS or Android. Create your account and enroll your biometrics in seconds."
              index={0}
            />
            <Step
              number={2}
              icon={Bell}
              title="Receive Push Notification"
              description="When a login is attempted, you get an instant push notification on your registered device."
              index={1}
            />
            <Step
              number={3}
              icon={CheckCircle}
              title="Approve or Reject"
              description="One tap to approve, one tap to reject. Full history logged with device details and timestamps."
              index={2}
            />
          </motion.div>
        </div>
      </Section>

      {/* ===== FEATURES GRID ===== */}
      <Section
        className="py-24 lg:py-32 bg-muted overflow-hidden"
        variants={staggerContainer}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeUp} className="text-center mb-16 lg:mb-20">
            <span className="text-sm font-bold text-primary tracking-widest uppercase">
              Features
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              Everything you need.{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Nothing you don&apos;t.
              </span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Enterprise-grade security features packaged in a beautiful,
              open-source mobile app.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, i) => (
              <FeatureCard key={feature.title} {...feature} index={i} />
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ===== SECURITY SECTION ===== */}
      <Section className="py-24 lg:py-32 bg-gradient-to-br from-gray-950 via-gray-900 to-blue-950 text-white overflow-hidden relative">
        {/* Glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[128px]"
          aria-hidden="true"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <motion.div variants={slideInLeft}>
              <span className="text-sm font-bold text-blue-400 tracking-widest uppercase">
                Security First
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Built for{" "}
                <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  paranoid
                </span>{" "}
                engineers
              </h2>
              <p className="mt-6 text-lg text-gray-400 leading-relaxed">
                Every authentication decision is backed by industry-standard
                cryptography, timing-safe comparisons, and defense-in-depth
                design patterns.
              </p>
            </motion.div>

            <motion.div variants={slideInRight}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Key,
                    title: "PBKDF2-SHA512",
                    desc: "100K iterations with unique salts per key",
                  },
                  {
                    icon: Shield,
                    title: "XSS Prevention",
                    desc: "HTML escaping & input validation on all endpoints",
                  },
                  {
                    icon: Lock,
                    title: "Timing-Safe Auth",
                    desc: "crypto.timingSafeEqual() prevents side-channel attacks",
                  },
                  {
                    icon: Monitor,
                    title: "CORS Configured",
                    desc: "Locked-down cross-origin access for API endpoints",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors"
                  >
                    <item.icon className="w-6 h-6 text-blue-400 mb-3" />
                    <h4 className="text-sm font-bold text-white mb-1">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </Section>

      {/* ===== OPEN SOURCE CTA ===== */}
      <Section className="py-24 lg:py-32 bg-background overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div variants={scaleUp} className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-gray-950 rounded-3xl flex items-center justify-center mx-auto shadow-xl shadow-gray-900/20">
              <Github className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight mb-6"
          >
            Open source.{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Forever free.
            </span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            MIEAuth is fully open source under the MIT license. Inspect the
            code, submit PRs, fork it for your own use — we believe security
            software should be transparent.
          </motion.p>
          <motion.div
            variants={fadeUp}
            custom={2}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <a
              href="https://github.com/mieweb/mieweb_auth_app"
              target="_blank"
              rel="noopener noreferrer"
              className={
                buttonVariants({ size: "lg" }) +
                " bg-gray-900 hover:bg-gray-800 text-white font-semibold no-underline"
              }
            >
              <span className="shrink-0">
                <Github className="w-5 h-5" />
              </span>
              View on GitHub
            </a>
            <a
              href="/test-notification"
              className={
                buttonVariants({ size: "lg", variant: "outline" }) +
                " font-semibold no-underline"
              }
            >
              <span className="shrink-0">
                <Bell className="w-5 h-5" />
              </span>
              Send a Test Notification
            </a>
          </motion.div>
        </div>
      </Section>

      {/* ===== FINAL CTA ===== */}
      <Section className="py-24 lg:py-32 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white overflow-hidden relative">
        <div
          className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-6"
          >
            Ready to secure your app?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-lg text-blue-100 max-w-2xl mx-auto mb-10"
          >
            Download MIE Auth today and add biometric, push-notification-based
            two-factor authentication to your application in minutes.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="justify-center">
            <AppStoreButtons variant="light" className="justify-center" />
          </motion.div>
        </div>
      </Section>
    </Layout>
  );
};

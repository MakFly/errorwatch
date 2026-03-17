"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Bug,
  BarChart3,
  Users,
  Code,
  Server,
  Shield,
  ArrowRight,
  Check,
  Star,
  Github,
  Play,
} from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
} from "framer-motion";
import { useRef } from "react";
import { useTranslations } from "next-intl";

// ═══════════════════════════════════════════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════════════════════════════════════════

const fadeInUp = {
  hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)"
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Animated Components
// ═══════════════════════════════════════════════════════════════════════════════

function AnimatedSection({
  children,
  className = "",
  delay = 0
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={fadeInUp}
        transition={{ duration: 0.5, delay: delay / 1000 }}
        className={className}
        style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}

function FloatingGradient({
  className,
  delay = 0
}: {
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      animate={{
        x: [0, 30, -20, 0],
        y: [0, -40, 20, 0],
        scale: [1, 1.1, 0.95, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
        delay
      }}
      style={{ willChange: "transform" }}
    />
  );
}

function TiltCard({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    ref.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transition: "transform 0.15s ease-out",
        transformStyle: "preserve-3d",
        willChange: "transform"
      }}
    >
      {children}
    </div>
  );
}

function MagneticButton({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    ref.current.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
  };

  const handleMouseLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "translate(0px, 0px)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transition: "transform 0.2s ease-out",
        willChange: "transform"
      }}
    >
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hero Section
// ═══════════════════════════════════════════════════════════════════════════════

function HeroSection() {
  const t = useTranslations("marketing");
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const badges = [
    { icon: Star, text: t("hero.badge1"), color: "violet" },
    { icon: Shield, text: t("hero.badge2"), color: "emerald" },
    { icon: Zap, text: t("hero.badge3"), color: "blue" },
  ];

  const stats = [
    { label: t("hero.stats.unresolved"), value: "23", color: "red" },
    { label: t("hero.stats.eventsToday"), value: "1,284", color: "violet" },
    { label: t("hero.stats.new24h"), value: "7", color: "amber" },
    { label: t("hero.stats.resolved"), value: "156", color: "emerald" },
  ];

  const errors = [
    { msg: "TypeError: Cannot read property 'id' of undefined", count: 847, time: "2m ago" },
    { msg: "ReferenceError: fetch is not defined", count: 234, time: "5m ago" },
    { msg: "SyntaxError: Unexpected token '<'", count: 156, time: "12m ago" },
  ];

  return (
    <section ref={ref} className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      {/* Animated background gradients with parallax */}
      <div className="absolute inset-0 -z-10">
        <FloatingGradient
          className="absolute left-1/2 top-0 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-violet-600/20 blur-[120px]"
        />
        <FloatingGradient
          className="absolute right-0 top-1/2 h-[400px] w-[400px] rounded-full bg-purple-600/20 blur-[100px]"
          delay={2}
        />
        <FloatingGradient
          className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-indigo-600/15 blur-[80px]"
          delay={4}
        />
      </div>

      <motion.div
        className="mx-auto max-w-7xl"
        style={{ y, opacity }}
      >
        <div className="mx-auto max-w-3xl text-center">
          {/* Animated Badges */}
          <motion.div
            className="mb-8 flex flex-wrap items-center justify-center gap-3"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            {badges.map((badge) => (
              <motion.span
                key={badge.text}
                variants={scaleIn}
                whileHover={{ scale: 1.08, y: -2 }}
                className={`inline-flex items-center gap-1.5 rounded-full border border-${badge.color}-500/30 bg-${badge.color}-500/10 px-3 py-1 text-xs font-medium text-${badge.color}-400 cursor-default`}
              >
                <badge.icon className="h-3 w-3" />
                {badge.text}
              </motion.span>
            ))}
          </motion.div>

          {/* Animated Headline */}
          <motion.h1
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {t("hero.titleLine1")}{" "}
            </motion.span>
            <motion.span
              className="bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 bg-clip-text text-transparent bg-[length:200%_100%]"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"]
              }}
              transition={{
                opacity: { duration: 0.6, delay: 0.4 },
                y: { duration: 0.6, delay: 0.4 },
                backgroundPosition: {
                  duration: 5,
                  repeat: Infinity,
                  ease: "linear"
                }
              }}
            >
              {t("hero.titleLine2")}
            </motion.span>
          </motion.h1>

          {/* Animated Subtitle */}
          <motion.p
            className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl"
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            {t("hero.subtitle")}
          </motion.p>

          {/* Animated CTA Buttons */}
          <motion.div
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <MagneticButton>
              <Link href="/signup">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button size="default" className="h-12 gap-2 bg-gradient-to-r from-violet-600 to-purple-600 px-8 text-base hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-600/25 hover:shadow-violet-600/40 transition-shadow">
                    {t("hero.ctaPrimary")}
                    <motion.span
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </motion.span>
                  </Button>
                </motion.div>
              </Link>
            </MagneticButton>
            <MagneticButton>
              <Link href="#how-it-works">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button size="default" variant="outline" className="h-12 gap-2 px-8 text-base group">
                    <motion.span
                      className="inline-block"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Play className="h-4 w-4" />
                    </motion.span>
                    {t("hero.ctaSecondary")}
                  </Button>
                </motion.div>
              </Link>
            </MagneticButton>
          </motion.div>

          {/* Social proof */}
          <motion.p
            className="mt-8 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            {t("hero.trustBar")}
          </motion.p>
        </div>

        {/* Animated Dashboard Preview with Tilt */}
        <motion.div
          className="relative mt-16"
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
          <TiltCard className="relative mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-2xl shadow-violet-600/10">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-border/50 bg-card/80 px-4 py-3">
                <div className="flex gap-1.5">
                  <motion.div
                    className="h-3 w-3 rounded-full bg-red-500/80"
                    whileHover={{ scale: 1.2 }}
                  />
                  <motion.div
                    className="h-3 w-3 rounded-full bg-yellow-500/80"
                    whileHover={{ scale: 1.2 }}
                  />
                  <motion.div
                    className="h-3 w-3 rounded-full bg-green-500/80"
                    whileHover={{ scale: 1.2 }}
                  />
                </div>
                <span className="ml-2 text-xs text-muted-foreground">{t("hero.dashboardPreview")}</span>
              </div>

              <div className="p-6">
                {/* Animated Stats Grid */}
                <motion.div
                  className="grid grid-cols-4 gap-4 mb-6"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {stats.map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      variants={fadeInUp}
                      whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      className="rounded-lg border border-border/50 bg-card/30 p-4 cursor-default"
                    >
                      <motion.p
                        className="text-2xl font-bold"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 + i * 0.1 }}
                      >
                        {stat.value}
                      </motion.p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Animated Error List */}
                <motion.div
                  className="space-y-3"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {errors.map((error, i) => (
                    <motion.div
                      key={i}
                      variants={fadeInUp}
                      whileHover={{
                        x: 4,
                        backgroundColor: "rgba(139, 92, 246, 0.05)",
                        transition: { duration: 0.2 }
                      }}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-card/30 p-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                        >
                          <Bug className="h-4 w-4 text-red-400" />
                        </motion.div>
                        <div>
                          <p className="text-sm font-medium truncate max-w-md">{error.msg}</p>
                          <p className="text-xs text-muted-foreground">{error.time}</p>
                        </div>
                      </div>
                      <motion.span
                        className="text-sm font-medium text-muted-foreground"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + i * 0.1 }}
                      >
                        {error.count}
                      </motion.span>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </div>
          </TiltCard>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Features Section
// ═══════════════════════════════════════════════════════════════════════════════

function FeaturesSection() {
  const t = useTranslations("marketing");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const featureIcons = [Bug, BarChart3, Users, Code, Server, Shield];
  const featureColors = ["red", "violet", "blue", "emerald", "amber", "purple"];

  const features = featureIcons.map((icon, i) => ({
    icon,
    title: t(`features.items.${i}.title`),
    description: t(`features.items.${i}.description`),
    color: featureColors[i],
  }));

  const colorClasses: Record<string, string> = {
    red: "bg-red-500/10 text-red-400 group-hover:bg-red-500/20",
    violet: "bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/20",
    blue: "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20",
    purple: "bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20",
  };

  const glowClasses: Record<string, string> = {
    red: "group-hover:shadow-red-500/20",
    violet: "group-hover:shadow-violet-500/20",
    blue: "group-hover:shadow-blue-500/20",
    emerald: "group-hover:shadow-emerald-500/20",
    amber: "group-hover:shadow-amber-500/20",
    purple: "group-hover:shadow-purple-500/20",
  };

  return (
    <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("features.title")}{" "}
            <span className="text-violet-400">{t("features.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("features.subtitle")}
          </p>
        </AnimatedSection>

        <motion.div
          ref={ref}
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-card/30 p-6 transition-all hover:border-violet-500/30 hover:bg-card/50 cursor-default shadow-lg shadow-transparent ${glowClasses[feature.color]} hover:shadow-xl`}
            >
              {/* Glow effect on hover */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${feature.color === 'violet' ? 'rgba(139, 92, 246, 0.15)' : feature.color === 'red' ? 'rgba(239, 68, 68, 0.15)' : feature.color === 'blue' ? 'rgba(59, 130, 246, 0.15)' : feature.color === 'emerald' ? 'rgba(16, 185, 129, 0.15)' : feature.color === 'amber' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(168, 85, 247, 0.15)'}, transparent 70%)`
                }}
              />

              <motion.div
                className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[feature.color]} transition-colors`}
                whileHover={{ rotate: [0, -10, 10, 0], transition: { duration: 0.5 } }}
              >
                <feature.icon className="h-6 w-6" />
              </motion.div>
              <h3 className="relative text-lg font-semibold">{feature.title}</h3>
              <p className="relative mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// How It Works Section
// ═══════════════════════════════════════════════════════════════════════════════

function HowItWorksSection() {
  const t = useTranslations("marketing");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const steps = [
    {
      step: "01",
      title: t("howItWorks.steps.0.title"),
      description: t("howItWorks.steps.0.description"),
      code: `bun add @error-monitoring/sdk-core @error-monitoring/sdk-nextjs`,
    },
    {
      step: "02",
      title: t("howItWorks.steps.1.title"),
      description: t("howItWorks.steps.1.description"),
      code: `setupErrorMonitoring({
  apiKey: 'your-api-key',
  endpoint: 'https://errors.yourcompany.com'
})`,
    },
    {
      step: "03",
      title: t("howItWorks.steps.2.title"),
      description: t("howItWorks.steps.2.description"),
      code: `// Errors are captured automatically!
// Or manually capture:
captureException(error, { tags: { module: 'checkout' } })`,
    },
  ];

  return (
    <section id="how-it-works" className="px-4 py-24 sm:px-6 lg:px-8 bg-card/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <FloatingGradient
          className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]"
          delay={1}
        />
      </div>

      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("howItWorks.title")}{" "}
            <span className="text-violet-400">{t("howItWorks.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("howItWorks.subtitle")}
          </p>
        </AnimatedSection>

        <div ref={ref} className="mx-auto mt-16 max-w-4xl">
          <div className="space-y-12">
            {steps.map((item, index) => (
              <motion.div
                key={item.step}
                className="relative flex gap-8"
                initial={{ opacity: 0, x: -30 }}
                animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.2,
                  ease: [0.25, 0.4, 0.25, 1]
                }}
              >
                {/* Animated connector line */}
                {index < steps.length - 1 && (
                  <motion.div
                    className="absolute left-6 top-16 w-px bg-gradient-to-b from-violet-500 to-transparent"
                    initial={{ height: 0 }}
                    animate={isInView ? { height: "calc(100% - 2rem)" } : { height: 0 }}
                    transition={{ duration: 0.8, delay: 0.5 + index * 0.2 }}
                  />
                )}

                {/* Animated step number */}
                <motion.div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-lg font-bold shadow-lg shadow-violet-600/25"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  animate={isInView ? {
                    boxShadow: [
                      "0 10px 15px -3px rgba(139, 92, 246, 0.25)",
                      "0 10px 25px -3px rgba(139, 92, 246, 0.4)",
                      "0 10px 15px -3px rgba(139, 92, 246, 0.25)"
                    ]
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {item.step}
                </motion.div>

                {/* Content */}
                <div className="flex-1 pb-8">
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="mt-2 text-muted-foreground">{item.description}</p>

                  {/* Animated code block */}
                  <motion.div
                    className="mt-4 overflow-hidden rounded-lg border border-border/50 bg-card/80"
                    whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
                  >
                    <div className="flex items-center gap-2 border-b border-border/50 bg-card px-4 py-2">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                      </div>
                    </div>
                    <motion.pre
                      className="overflow-x-auto p-4 text-sm"
                      initial={{ opacity: 0 }}
                      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ duration: 0.5, delay: 0.3 + index * 0.2 }}
                    >
                      <code className="text-violet-300">{item.code}</code>
                    </motion.pre>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pricing Section
// ═══════════════════════════════════════════════════════════════════════════════

function PricingSection() {
  const t = useTranslations("marketing");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const plans = [
    {
      name: t("pricing.tiers.0.name"),
      description: t("pricing.tiers.0.description"),
      price: t("pricing.tiers.0.price"),
      period: t("pricing.tiers.0.period"),
      features: Array.from({ length: 6 }, (_, i) => t(`pricing.tiers.0.features.${i}`)),
      cta: t("pricing.tiers.0.cta"),
      href: "https://github.com",
      highlighted: false,
    },
    {
      name: t("pricing.tiers.1.name"),
      description: t("pricing.tiers.1.description"),
      price: t("pricing.tiers.1.price"),
      period: t("pricing.tiers.1.period"),
      features: Array.from({ length: 6 }, (_, i) => t(`pricing.tiers.1.features.${i}`)),
      cta: t("pricing.tiers.1.cta"),
      href: "/signup",
      highlighted: true,
    },
    {
      name: t("pricing.tiers.2.name"),
      description: t("pricing.tiers.2.description"),
      price: t("pricing.tiers.2.price"),
      period: t("pricing.tiers.2.period"),
      features: Array.from({ length: 6 }, (_, i) => t(`pricing.tiers.2.features.${i}`)),
      cta: t("pricing.tiers.2.cta"),
      href: "#",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("pricing.title")}{" "}
            <span className="text-violet-400">{t("pricing.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </AnimatedSection>

        <motion.div
          ref={ref}
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={fadeInUp}
              whileHover={{ y: -12, transition: { duration: 0.3 } }}
              className={`relative overflow-hidden rounded-2xl border p-8 transition-shadow ${
                plan.highlighted
                  ? "border-violet-500/50 bg-gradient-to-b from-violet-500/10 to-transparent shadow-xl shadow-violet-500/10"
                  : "border-border/50 bg-card/30 hover:shadow-lg"
              }`}
            >
              {plan.highlighted && (
                <motion.div
                  className="absolute -right-12 top-6 rotate-45 bg-gradient-to-r from-violet-600 to-purple-600 px-12 py-1 text-xs font-medium"
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {t("pricing.popular")}
                </motion.div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-6">
                <motion.span
                  className="text-4xl font-bold"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                  transition={{ delay: 0.3 + i * 0.1, type: "spring" }}
                >
                  {plan.price}
                </motion.span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature, j) => (
                  <motion.li
                    key={feature}
                    className="flex items-center gap-3 text-sm"
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                    transition={{ delay: 0.4 + i * 0.1 + j * 0.05 }}
                  >
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Check className="h-4 w-4 text-emerald-400" />
                    </motion.div>
                    <span>{feature}</span>
                  </motion.li>
                ))}
              </ul>

              <MagneticButton className="w-full">
                <Link href={plan.href} className="block">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      className={`w-full ${
                        plan.highlighted
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-600/25"
                          : ""
                      }`}
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </motion.div>
                </Link>
              </MagneticButton>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Testimonials Section
// ═══════════════════════════════════════════════════════════════════════════════

function TestimonialsSection() {
  const t = useTranslations("marketing");
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const testimonials = Array.from({ length: 3 }, (_, i) => ({
    quote: t(`testimonials.items.${i}.quote`),
    author: t(`testimonials.items.${i}.author`),
    role: t(`testimonials.items.${i}.role`),
    company: t(`testimonials.items.${i}.company`),
  }));

  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8 bg-card/30 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <FloatingGradient
          className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-purple-600/10 blur-[100px]"
          delay={2}
        />
      </div>

      <div className="mx-auto max-w-7xl">
        <AnimatedSection className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("testimonials.title")}{" "}
            <span className="text-violet-400">{t("testimonials.titleHighlight")}</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("testimonials.subtitle")}
          </p>
        </AnimatedSection>

        <motion.div
          ref={ref}
          className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={fadeInUp}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              className="rounded-2xl border border-border/50 bg-card/50 p-6 hover:border-violet-500/30 transition-colors cursor-default"
            >
              {/* Animated stars */}
              <div className="mb-4 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    animate={isInView ? {
                      opacity: 1,
                      scale: 1,
                      rotate: 0
                    } : {
                      opacity: 0,
                      scale: 0,
                      rotate: -180
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                      delay: 0.3 + index * 0.1 + i * 0.05
                    }}
                    whileHover={{ scale: 1.3, rotate: 15 }}
                  >
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </motion.div>
                ))}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              <motion.div
                className="mt-6 flex items-center gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={{ delay: 0.5 + index * 0.1 }}
              >
                <motion.div
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-700"
                  whileHover={{ scale: 1.1, rotate: 10 }}
                >
                  <span className="text-sm font-bold">{testimonial.author[0]}</span>
                </motion.div>
                <div>
                  <p className="text-sm font-medium">{testimonial.author}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CTA Section
// ═══════════════════════════════════════════════════════════════════════════════

function CTASection() {
  const t = useTranslations("marketing");
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/20 via-purple-600/20 to-violet-600/20 px-8 py-16 sm:px-16 sm:py-24"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6 }}
        >
          {/* Animated background effects */}
          <div className="absolute inset-0 -z-10">
            <FloatingGradient
              className="absolute left-0 top-0 h-[400px] w-[400px] rounded-full bg-violet-600/30 blur-[100px]"
              delay={0}
            />
            <FloatingGradient
              className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-purple-600/30 blur-[100px]"
              delay={3}
            />
          </div>

          {/* Decorative grid pattern */}
          <div
            className="absolute inset-0 -z-10 opacity-20"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(139, 92, 246, 0.3) 1px, transparent 0)`,
              backgroundSize: "40px 40px"
            }}
          />

          <motion.div
            className="relative mx-auto max-w-2xl text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t("cta.title")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("cta.subtitle")}
            </p>

            <motion.div
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <MagneticButton>
                <Link href="/signup">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button size="default" className="h-12 gap-2 bg-white px-8 text-base text-violet-900 hover:bg-white/90 shadow-xl shadow-white/20">
                      {t("cta.primary")}
                      <motion.span
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </motion.span>
                    </Button>
                  </motion.div>
                </Link>
              </MagneticButton>
              <MagneticButton>
                <Link href="https://github.com" target="_blank">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Button size="default" variant="outline" className="h-12 gap-2 border-white/20 px-8 text-base hover:bg-white/10 backdrop-blur-sm">
                      <Github className="h-4 w-4" />
                      {t("cta.secondary")}
                    </Button>
                  </motion.div>
                </Link>
              </MagneticButton>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page Export
// ═══════════════════════════════════════════════════════════════════════════════

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
    </>
  );
}

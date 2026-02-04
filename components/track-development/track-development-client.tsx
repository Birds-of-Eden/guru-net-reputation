// components/track-development/track-development-client.tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function TrackDevelopment() {
  const [preview, setPreview] = useState<string | null>(null);

  const months = [
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
  ];

  const gen = (type: "previous" | "current", set: 1 | 2) =>
    months.map(
      (m) => `/images/joseph-brophy-${type}-${set}-${m.toLowerCase()}.png`
    );

  const baseline = "/images/joseph-brophy-baseline-1.png";

  const prev1 = gen("previous", 1);
  const prev2 = gen("previous", 2);
  const curr1 = gen("current", 1);
  const curr2 = gen("current", 2);

  return (
    <div className="min-h-screen w-full bg-linear-to-b from-indigo-50 via-white to-sky-100 dark:from-neutral-900 dark:to-black p-10">
      {/* Header */}
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 12 }}
        className="text-center mb-14"
      >
        <h1 className="text-4xl font-extrabold text-indigo-700 dark:text-indigo-300">
          🌟 Track Development Progress
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 text-lg">
          Package Start: 🗓️ <b>Feb 1, 2025</b> &nbsp;|&nbsp; Due: 🗓️{" "}
          <b>Oct 1, 2025 ✅</b>
        </p>
      </motion.div>

      {/* Baseline */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="text-center mb-20"
      >
        <h2 className="text-xl font-semibold text-indigo-600 dark:text-indigo-400 mb-3">
          📍 Baseline (Starting Point)
        </h2>
        <motion.div
          whileHover={{ scale: 1.03 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-block"
        >
          <Image
            src={baseline}
            alt="Baseline"
            width={600}
            height={400}
            priority
            className="rounded-2xl border border-indigo-100 shadow-lg cursor-pointer"
            onClick={() => setPreview(baseline)}
          />
        </motion.div>
      </motion.div>

      {/* Timeline */}
      <div className="relative grid md:grid-cols-[1fr_auto_1fr] gap-10">
        {/* Left - Previous */}
        <section>
          <h3 className="text-center text-lg font-semibold text-indigo-600 mb-6">
            ⏮️ Previous Progress
          </h3>
          <div className="space-y-8">
            {months.map((month, i) => (
              <motion.div
                key={month}
                whileInView={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: -30 }}
                transition={{ type: "spring", stiffness: 90, damping: 14 }}
                viewport={{ once: true }}
                className="group flex flex-col items-center rounded-xl bg-white/70 dark:bg-neutral-900/60 p-4 shadow-lg backdrop-blur-sm border border-indigo-100 dark:border-neutral-800"
              >
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {month}
                </p>
                <div className="flex gap-3 mt-2">
                  {[prev1[i], prev2[i]].map((src) => (
                    <Image
                      key={src}
                      src={src}
                      alt={month}
                      width={220}
                      height={150}
                      loading="lazy"
                      onClick={() => setPreview(src)}
                      className="rounded-lg border border-gray-200 shadow-sm cursor-pointer transition-transform duration-300 hover:scale-[1.07]"
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Center - Smooth Tracker */}
        <div className="hidden md:flex flex-col items-center relative">
          <div className="h-full w-[3px] bg-linear-to-b from-indigo-400 via-blue-500 to-emerald-400 rounded-full relative overflow-hidden">
            {months.map((m, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-md ring-4 ring-indigo-400"
                style={{ top: `${(i / (months.length - 1)) * 100}%` }}
                animate={{
                  boxShadow: [
                    "0 0 10px rgba(99,102,241,0.6)",
                    "0 0 20px rgba(16,185,129,0.7)",
                    "0 0 10px rgba(99,102,241,0.6)",
                  ],
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            ))}
          </div>
        </div>

        {/* Right - Current */}
        <section>
          <h3 className="text-center text-lg font-semibold text-indigo-600 mb-6">
            ⏩ Current Progress
          </h3>
          <div className="space-y-8">
            {months.map((month, i) => (
              <motion.div
                key={month}
                whileInView={{ opacity: 1, x: 0 }}
                initial={{ opacity: 0, x: 30 }}
                transition={{ type: "spring", stiffness: 90, damping: 14 }}
                viewport={{ once: true }}
                className="group flex flex-col items-center rounded-xl bg-white/70 dark:bg-neutral-900/60 p-4 shadow-lg backdrop-blur-sm border border-indigo-100 dark:border-neutral-800"
              >
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {month}
                </p>
                <div className="flex gap-3 mt-2">
                  {[curr1[i], curr2[i]].map((src) => (
                    <Image
                      key={src}
                      src={src}
                      alt={month}
                      width={220}
                      height={150}
                      loading="lazy"
                      onClick={() => setPreview(src)}
                      className="rounded-lg border border-gray-200 shadow-sm cursor-pointer transition-transform duration-300 hover:scale-[1.07]"
                    />
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      </div>

      {/* Preview Popup */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
          >
            <motion.img
              src={preview}
              alt="Preview"
              className="max-w-[90vw] max-h-[85vh] rounded-2xl border border-white/10 shadow-2xl"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              transition={{ type: "spring", stiffness: 200, damping: 18 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

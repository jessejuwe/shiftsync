"use client";

import { motion } from "framer-motion";

export default function LoadingScreen() {
  return (
    <div className="gradient-bg flex min-h-screen items-center justify-center">
      <div className="text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="mx-auto mb-4 h-16 w-16 rounded-full border-4 border-white border-t-transparent"
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-lg font-medium text-white"
        >
          Loading...
        </motion.p>
      </div>
    </div>
  );
}

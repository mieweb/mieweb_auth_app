import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SuccessToaster = ({ message, onClose, variant = "success" }) => {
  // Keep the latest onClose in a ref so the auto-close timer never depends on
  // its identity. Callers pass inline lambdas that change on every render, so
  // depending on onClose would restart the timer on unrelated re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Drive the auto-close timer off `message`: start it only when a toast is
  // actually shown and restart it whenever the message changes.
  useEffect(() => {
    if (!message) return undefined;
    const timer = setTimeout(() => {
      onCloseRef.current?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const bgColor = variant === "error" ? "bg-red-500" : "bg-green-500";

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "150%" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className={`fixed top-5 right-5 ${bgColor} text-white px-4 py-2 rounded shadow-lg`}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessToaster;

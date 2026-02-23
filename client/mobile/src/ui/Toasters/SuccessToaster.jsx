import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription } from "@mieweb/ui";

const SuccessToaster = ({ message, onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "150%" }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed top-5 right-5 z-50"
        >
          <Alert variant="success" dismissible onDismiss={onClose}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessToaster;

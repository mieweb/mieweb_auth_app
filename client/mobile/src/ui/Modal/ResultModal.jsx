import React, {useEffect} from 'react';
import { CheckCircle } from 'lucide-react';

const ResultModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-11/12 max-w-md p-8 text-center border border-gray-200 dark:border-gray-700 transform transition-all">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-full shadow-lg">
            <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
          Authentication Successful!
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You have been successfully authenticated.
        </p>
        <button
          className="w-full py-3 mt-2 text-white font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-98"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default ResultModal;

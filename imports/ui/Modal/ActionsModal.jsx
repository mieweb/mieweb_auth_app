import React from 'react';

const ActionsModal = ({ isOpen, onApprove, onReject, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-center">Authenticate?</h2>
        </div>
        <div className="p-4 flex flex-col items-center space-y-4">
          <button
            className="w-full py-2 text-white bg-green-500 rounded-lg hover:bg-green-600"
            onClick={onApprove}
          >
            Approve
          </button>
          <button
            className="w-full py-2 text-white bg-red-500 rounded-lg hover:bg-red-600"
            onClick={onReject}
          >
            Reject
          </button>
        </div>
        <button
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default ActionsModal;

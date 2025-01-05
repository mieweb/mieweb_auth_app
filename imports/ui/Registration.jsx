// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { FiUser, FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';

// export const RegistrationPage = () => {
//   const [formData, setFormData] = useState({
//     email: '',
//     firstName: '',
//     lastName: '',
//     pin: ''
//   });
//   const [deviceInfo, setDeviceInfo] = useState(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const handleDeviceReady = () => {
//       if (device.cordova) {
//         setDeviceInfo({
//           model: device.model,
//           platform: device.platform,
//           uuid: device.uuid,
//           version: device.version,
//           manufacturer: device.manufacturer,
//         });
//       }
//     };

//     document.addEventListener('deviceready', handleDeviceReady);
//     return () => document.removeEventListener('deviceready', handleDeviceReady);
//   }, []);

//   const handleRegister = () => {
//     if (!deviceInfo) {
//       alert('Device information not available');
//       return;
//     }

//     Meteor.call(
//       'users.register',
//       { ...formData, deviceDetails: deviceInfo },
//       (err, res) => {
//         if (err) {
//           alert(`Registration failed: ${err.reason}`);
//         } else {
//           alert('Registration successful!');
//           navigate('/login');
//         }
//       }
//     );
//   };

//   const handleChange = (e) => {
//     setFormData({
//       ...formData,
//       [e.target.name]: e.target.value
//     });
//   };

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center p-4">
//       <button
//         onClick={() => navigate('/')}
//         className="absolute top-4 left-4 flex items-center text-gray-600 hover:text-blue-600 transition-colors"
//       >
//         <FiArrowLeft className="mr-1" /> Back
//       </button>

//       <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg">
//         <div>
//           <h2 className="text-3xl font-bold text-center text-gray-900">Create Account</h2>
//           <p className="mt-2 text-center text-gray-600">Join our community today</p>
//         </div>

//         <div className="space-y-6">
//           <div>
//             <label className="text-sm font-medium text-gray-700">Email</label>
//             <div className="mt-1 relative">
//               <FiMail className="absolute top-3 left-3 text-gray-400" />
//               <input
//                 name="email"
//                 type="email"
//                 value={formData.email}
//                 onChange={handleChange}
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                 placeholder="Enter your email"
//               />
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-4">
//             <div>
//               <label className="text-sm font-medium text-gray-700">First Name</label>
//               <div className="mt-1 relative">
//                 <FiUser className="absolute top-3 left-3 text-gray-400" />
//                 <input
//                   name="firstName"
//                   type="text"
//                   value={formData.firstName}
//                   onChange={handleChange}
//                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                   placeholder="First Name"
//                 />
//               </div>
//             </div>

//             <div>
//               <label className="text-sm font-medium text-gray-700">Last Name</label>
//               <div className="mt-1 relative">
//                 <FiUser className="absolute top-3 left-3 text-gray-400" />
//                 <input
//                   name="lastName"
//                   type="text"
//                   value={formData.lastName}
//                   onChange={handleChange}
//                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                   placeholder="Last Name"
//                 />
//               </div>
//             </div>
//           </div>

//           <div>
//             <label className="text-sm font-medium text-gray-700">PIN</label>
//             <div className="mt-1 relative">
//               <FiLock className="absolute top-3 left-3 text-gray-400" />
//               <input
//                 name="pin"
//                 type="password"
//                 value={formData.pin}
//                 onChange={handleChange}
//                 className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//                 placeholder="Create a PIN"
//               />
//             </div>
//           </div>

//           <button
//             onClick={handleRegister}
//             className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition hover:scale-105"
//           >
//             Create Account
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';

export const RegistrationPage = ({ deviceDetails }) => {
  const [formData, setFormData] = useState({
    email: '', firstName: '', lastName: '', pin: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deviceDetails) {
      alert('Device information not available');
      return;
    }

    setLoading(true);
    const sessionDeviceInfo = Session.get('capturedDeviceInfo')
    if (sessionDeviceInfo.uuid == deviceDetails) {
      try {
        await new Promise((resolve, reject) => {
          Meteor.call('users.register', 
            { ...formData, sessionDeviceInfo }, 
            err => err ? reject(err) : resolve()
          );
        });
        navigate('/login');
      } catch (err) {
        console.error('Registration failed:', err);
        alert(err.reason || 'Registration failed. Please try again.');
      }
      setLoading(false);
      
    } else {
      alert(err.reason || 'Registration failed. Device uuid is not matched or tampered.');
      
    }


  };

  const inputFields = [
    { name: 'email', icon: FiMail, type: 'email', placeholder: 'Enter your email' },
    { name: 'firstName', icon: FiUser, type: 'text', placeholder: 'First Name' },
    { name: 'lastName', icon: FiUser, type: 'text', placeholder: 'Last Name' },
    { 
      name: 'pin', 
      icon: FiLock, 
      type: 'password', 
      placeholder: 'Create a PIN (4-6 digits)',
      minLength: "4",
      maxLength: "6",
      pattern: "\\d*"
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-4"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 flex items-center text-gray-600 hover:text-blue-600"
      >
        <FiArrowLeft className="mr-1" /> Back
      </motion.button>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-lg"
      >
        <div className="text-center space-y-2">
          <motion.h2 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="text-3xl font-bold text-gray-900"
          >
            Create Account
          </motion.h2>
          <p className="text-gray-600">Join our community today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputFields.map((field, index) => (
              <motion.div
                key={field.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className={field.name === 'email' ? 'md:col-span-2' : ''}
              >
                <label className="text-sm font-medium text-gray-700">
                  {field.name.charAt(0).toUpperCase() + field.name.slice(1)}
                </label>
                <div className="mt-1 relative">
                  <field.icon className="absolute top-3 left-3 text-gray-400" />
                  <input
                    {...field}
                    required
                    value={formData[field.name]}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      [e.target.name]: e.target.value
                    }))}
                    className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
};
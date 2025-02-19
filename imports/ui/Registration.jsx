import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiLock } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import axios from 'axios';


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
    const sessionDeviceInfo = Session.get('capturedDeviceInfo');
    const fcmDeviceToken = Session.get('deviceToken'); // Get FCM token from session

    if (sessionDeviceInfo.uuid === deviceDetails) {
      try {
        // First register the user with deviceInfo
        const registerUser = await new Promise((resolve, reject) => {
          Meteor.call('users.register', 
            { 
              ...formData,
              sessionDeviceInfo, fcmDeviceToken
            }, 
            (err, result) => {
              if (err) {
                console.error("Registration error:", err);
                reject(err);
              } else {
                console.log("Registration success:", result);                
                resolve(result);
              }
            }
          );
        });
        console.log(JSON.stringify({registerUser}));
        console.log('Calling the external API for app Id update in LDAP');
        if (registerUser && registerUser.resAppId) {
          console.log(`Formdata is : ${formData}`);
          console.log(`Form data in JSON is : ${JSON.stringify({formData})}`);
          const uName = formData.email.split('@')[0];
          console.log(`username after split is : ${uName}`);
          Meteor.call('updateAppId', uName, registerUser.resAppId, (error, result) => {
            if (error) {
              console.log('Error', JSON.stringify({error}));
            } else {
              console.log('Success', JSON.stringify({result}));
            }
          });
      }
        console.log('After the external Call');
        console.log(`the result is : ${JSON.stringify({registerUser})}`);

        // Navigate to login after successful registration
        navigate('/login');
      } catch (err) {
        console.error('Registration failed:', err);
        alert(err.reason || 'Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }

    } else {
      alert('Registration failed. Device uuid is not matched or tampered.');
      setLoading(false);
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
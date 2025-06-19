import React, { useState, useEffect } from 'react';
import { initializeOTLP, withTrace } from '@astrot1988/otlp';

// Хук для инициализации OTLP
function useOTLP() {
  useEffect(() => {
    initializeOTLP({
      enabled: true,
      serviceName: 'react-app',
      serviceVersion: '1.0.0',
      debug: process.env.NODE_ENV === 'development',
      endpoint: process.env.REACT_APP_OTLP_ENDPOINT,
      enableAutoInstrumentation: true
    });
  }, []);
}

// Компонент с трейсингом
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useOTLP();

  useEffect(() => {
    loadUser();
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      setError(null);

      const userData = await withTrace('user-profile-load', async () => {
        // Имитация API запроса
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      }, {
        attributes: {
          'user.id': userId,
          'component': 'UserProfile'
        }
      });

      setUser(userData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (updates: any) => {
    try {
      const updatedUser = await withTrace('user-profile-update', async () => {
        const response = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      }, {
        attributes: {
          'user.id': userId,
          'operation': 'update',
          'fields_updated': Object.keys(updates).join(',')
        }
      });

      setUser(updatedUser);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>User Profile</h2>
      {user && (
        <div>
          <p>Name: {user.name}</p>
          <p>Email: {user.email}</p>
          <button onClick={() => updateUser({ lastSeen: new Date().toISOString() })}>
            Update Last Seen
          </button>
        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, CheckCircle, Circle } from 'lucide-react';
import confetti from 'canvas-confetti';
import './App.css';

import { SignedIn, SignedOut, SignInButton, UserButton, useUser, useAuth } from "@clerk/clerk-react";

interface Todo {
  id: string;
  text: string;
  completed: boolean;
  animationType: 'confetti' | 'particles' | 'pulse';
}

const App: React.FC = () => {
  return (
    <div className="app-container">
      <SignedOut>
        <div className="auth-hero">
          <header>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="title"
            >
              TaskFlow
            </motion.h1>
            <p className="subtitle">Premium Productivity</p>
          </header>
          <div className="glass-card auth-card">
            <h2>Welcome to TaskFlow</h2>
            <p>Sign in to sync your tasks across all your devices with cloud persistence.</p>
            <SignInButton mode="modal">
              <button className="add-btn login-btn">Get Started</button>
            </SignInButton>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <TodoAuthenticatedApp />
      </SignedIn>
    </div>
  );
};

const TodoAuthenticatedApp: React.FC = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isLoaded = React.useRef(false);

  // Fetch todos on load
  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const token = await getToken();
        const response = await fetch('/api/todos', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTodos(data);
          isLoaded.current = true;
          setSyncError(null);
        } else {
          const errData = await response.json();
          setSyncError(errData.error || 'Failed to load tasks');
          isLoaded.current = true;
        }
      } catch (error) {
        console.error('Failed to fetch todos:', error);
        setSyncError('Network error while syncing');
        isLoaded.current = true;
      }
    };
    fetchTodos();
  }, [getToken]);

  // Save todos whenever they change
  useEffect(() => {
    const saveTodos = async () => {
      if (!isLoaded.current) return;

      setIsSyncing(true);
      setSyncError(null);
      try {
        const token = await getToken();
        const response = await fetch('/api/todos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ todos }),
        });

        if (!response.ok) {
          const errData = await response.json();
          setSyncError(errData.error || 'Failed to save tasks');
        }
      } catch (error) {
        console.error('Failed to save todos:', error);
        setSyncError('Cloud sync failed');
      } finally {
        setTimeout(() => setIsSyncing(false), 800);
      }
    };

    const timeoutId = setTimeout(saveTodos, 1000);
    return () => clearTimeout(timeoutId);
  }, [todos, getToken]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const animationTypes: Todo['animationType'][] = ['confetti', 'particles', 'pulse'];
    const newTodo: Todo = {
      id: crypto.randomUUID(),
      text: inputValue,
      completed: false,
      animationType: animationTypes[Math.floor(Math.random() * animationTypes.length)],
    };

    setTodos([newTodo, ...todos]);
    setInputValue('');
  };

  const toggleTodo = (id: string) => {
    setTodos(prev => prev.map(todo => {
      if (todo.id === id && !todo.completed) {
        triggerAnimation(todo.animationType);
        return { ...todo, completed: true };
      }
      return todo;
    }));
  };

  const removeTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const triggerAnimation = (type: Todo['animationType']) => {
    if (type === 'confetti') {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#10b981', '#3b82f6'],
        ticks: 200,
        gravity: 0.8,
        scalar: 1,
        shapes: ['circle', 'square'] as confetti.Shape[]
      });
    } else if (type === 'particles') {
      const count = 40;
      const defaults = {
        origin: { y: 0.7 },
        spread: 360,
        ticks: 50,
        gravity: 0,
        decay: 0.94,
        startVelocity: 30,
        shapes: ['circle'] as confetti.Shape[],
        colors: ['#3b82f6', '#ffffff']
      };

      confetti({
        ...defaults,
        particleCount: count,
        scalar: 0.75,
      });

      confetti({
        ...defaults,
        particleCount: count / 2,
        scalar: 1.2,
      });
    }
  };

  return (
    <>
      <header className="auth-header">
        <div className="user-profile">
          <UserButton appearance={{ elements: { userButtonAvatarBox: "user-avatar" } }} />
          <div className="user-info">
            <span className="user-name">Hello, {user?.firstName || 'Productivity Master'}</span>
            <p className="subtitle">Premium Account</p>
          </div>
        </div>
        <AnimatePresence>
          {isSyncing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="sync-badge"
            >
              Cloud Synced
            </motion.div>
          )}
          {syncError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="sync-badge error"
            >
              {syncError}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <form onSubmit={addTodo} className="input-group">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What needs to be done?"
          className="todo-input"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="submit"
          className="add-btn"
        >
          <Plus size={20} />
        </motion.button>
      </form>

      <div className="todo-list">
        <AnimatePresence mode='popLayout'>
          {todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={() => toggleTodo(todo.id)}
              onDelete={() => removeTodo(todo.id)}
            />
          ))}
        </AnimatePresence>
      </div>

    </>
  );
};

const TodoItem: React.FC<{
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}> = ({ todo, onToggle, onDelete }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`todo-item ${todo.completed ? 'completed' : ''}`}
    >
      <button onClick={onToggle} className="check-btn">
        {todo.completed ? (
          <CheckCircle className="icon-check" size={22} />
        ) : (
          <Circle className="icon-uncheck" size={22} />
        )}
      </button>

      <span className="todo-text">{todo.text}</span>

      <button onClick={onDelete} className="delete-btn">
        <Trash2 size={18} />
      </button>

      {todo.completed && todo.animationType === 'pulse' && (
        <motion.div
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0] }}
          transition={{ duration: 0.8 }}
          className="pulse-effect"
        />
      )}
    </motion.div>
  );
};

export default App;

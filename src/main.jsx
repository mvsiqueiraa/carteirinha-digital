import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { supabase } from './lib/supabase';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

async function testarSupabase() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')

  console.log('DATA:', data)
  console.log('ERROR:', error)
}

testarSupabase()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

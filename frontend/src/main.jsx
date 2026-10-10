import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './context/StoreProvider';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { ContentProvider } from './context/ContentContext';
import './styles/storefront.css';
import './styles/pages.css';
import './styles/navigation.css';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ContentProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </ContentProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>,
);
import './styles/account.css';
import './styles/contact.css';
import './styles/faq.css';
import './styles/section-title.css';
import './styles/buttons.css';
import './styles/checkout.css';
import './styles/responsive.css';
import './styles/selects.css';
import './styles/announcements.css';
import './styles/product-rail.css';

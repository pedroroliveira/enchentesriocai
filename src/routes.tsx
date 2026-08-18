import { RouteObject } from 'react-router-dom';
import HomePage from './pages/index';
import MapaPage from './pages/mapa';
import PrevisaoPage from './pages/previsao';
import AlertasPage from './pages/alertas';
import SobrePage from './pages/sobre';
import ContatoPage from './pages/contato';
import ProdNotFoundPage from './pages/_404';

const NotFoundPage = ProdNotFoundPage;

export const routes: RouteObject[] = [
  { path: '/',         element: <HomePage /> },
  { path: '/mapa',     element: <MapaPage /> },
  { path: '/previsao', element: <PrevisaoPage /> },
  { path: '/alertas',  element: <AlertasPage /> },
  { path: '/sobre',    element: <SobrePage /> },
  { path: '/contato',  element: <ContatoPage /> },
  { path: '*',         element: <NotFoundPage /> },
];

export type Path = '/' | '/mapa' | '/previsao' | '/alertas' | '/sobre' | '/contato';
export type Params = Record<string, string | undefined>;

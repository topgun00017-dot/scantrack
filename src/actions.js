// Sheets any screen can open (edit a task, quick add, edit a list); provided by App.js.
import { createContext, useContext } from 'react';
export const Actions = createContext(null);
export const useActions = () => useContext(Actions);

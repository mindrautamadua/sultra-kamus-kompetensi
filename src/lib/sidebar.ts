// Sidebar collapsed state lives on <html data-sidebar="collapsed"> (styled with the `collapsed:` variant in
// globals.css) and is remembered per browser in localStorage.
export const SIDEBAR_KEY = "sidebar";

// Inlined in <head> so a collapsed sidebar doesn't flash open before hydration.
export const SIDEBAR_INIT = `try{if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")document.documentElement.dataset.sidebar="collapsed"}catch(e){}`;

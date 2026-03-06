#!/usr/bin/env python3
"""HTTP Server with threading and no-cache headers for development."""
import http.server
import socketserver
import os

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress noisy 404 logs to keep console clean
        if '404' not in str(args):
            super().log_message(format, *args)

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Use ThreadingHTTPServer so audio/image requests don't block each other!
class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

print("🚀 Starting THREADED dev server on http://localhost:8080 (NO CACHE)")
ThreadedServer(('', 8080), NoCacheHandler).serve_forever()

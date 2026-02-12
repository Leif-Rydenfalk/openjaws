3. Caddyfile (Reverse Proxy Configuration)
This configures Caddy to act as the web server. It will handle the domain captureflow.net, manage HTTPS certificates automatically, and route traffic:
captureflow.net -> SvelteKit UI (port 5173 or whatever port ui uses in prod).
captureflow.net/tts/* -> TTS UI (port 5139).
Create this file in the project root:
Path: /home/asdfghj/openjaws/Caddyfile
code
Caddy
captureflow.net {
    # Main UI (SvelteKit)
    # Assumes SvelteKit is running on port 5173
    reverse_proxy localhost:5173

    # TTS Voice UI
    # Matches /tts and /tts/* and strips the prefix before sending to localhost:5139
    handle_path /tts/* {
        reverse_proxy localhost:5139
    }
}
How to Host
Install Caddy: sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list && sudo apt update && sudo apt install caddy
Point DNS: Create an A Record for captureflow.net pointing to your server's IP address.
Run Caddy: Run sudo caddy run in the directory containing the Caddyfile.
This will automatically provision an SSL certificate (Let's Encrypt) and route the traffic as requested.
import os
from garminconnect import Garmin
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import date, timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)

GARMIN_EMAIL = os.getenv('GARMIN_EMAIL')
GARMIN_PASSWORD = os.getenv('GARMIN_PASSWORD')

garmin_client = None

def get_garmin_client():
    global garmin_client
    if garmin_client is None:
        try:
            garmin_client = Garmin(GARMIN_EMAIL, GARMIN_PASSWORD)
            garmin_client.login()
            print("✅ Logged in to Garmin!")
        except Exception as e:
            print(f"❌ Login failed: {e}")
            return None
    return garmin_client

@app.route('/api/garmin/health', methods=['GET'])
def get_health_data():
    client = get_garmin_client()
    if not client:
        return jsonify({"error": "Failed to connect"}), 500

    try:
        today = date.today()
        stats = client.get_stats(today.isoformat())

        health_data = {
            "steps": stats.get("totalSteps") or 0,
            "calories": stats.get("totalKilocalories") or 0,
            "distance": (stats.get("totalDistanceMeters") or 0) / 1000,
            "sleepScore": stats.get("sleepScore") or None,
            "bodyBattery": stats.get("bodyBatteryChargedValue") or None
        }

        return jsonify(health_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/garmin/runs', methods=['GET'])
def get_runs():
    client = get_garmin_client()
    if not client:
        return jsonify({"error": "Failed to connect"}), 500

    try:
        activities = client.get_activities(0, 20)
        runs = []
        
        for act in activities:
            if 'run' in (act.get('activityType', {}).get('typeKey', '') or '').lower():
                distance = (act.get('distance') or 0) / 1000
                duration_sec = act.get('duration') or 0
                
                runs.append({
                    "id": act.get('activityId'),
                    "name": act.get('activityName'),
                    "date": (act.get('startTimeLocal') or '')[:10],
                    "distance_km": round(distance, 2),
                    "duration_min": round(duration_sec / 60, 0),
                    "pace": f"{int(duration_sec / distance // 60)}:{int(duration_sec / distance % 60):02d}" if distance > 0 else None,
                    "calories": act.get('calories'),
                    "avg_hr": act.get('averageHR')
                })
        
        return jsonify(runs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Garmin API on port 5001...")
    app.run(debug=True, port=5001)

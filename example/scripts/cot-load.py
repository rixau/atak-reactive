#!/usr/bin/env python3
"""Send N markers walking small circles as CoT, at --hz, to ATAK's default TCP
input (0.0.0.0:4242; on the emulator, redirect a host port to it first).

ATAK's TCP input frames one event per connection, so each event opens its own
socket. A persistent stream is accepted and silently ignored. Used by
cot-compare.sh; standalone:

    ./cot-load.py --count 100 --hz 1 --secs 300 --prefix H2H
"""
import argparse, socket, time, math

TPL = ('<?xml version="1.0" encoding="UTF-8"?>'
       '<event version="2.0" uid="{uid}" type="a-f-G-U-C" how="m-g"'
       ' time="{t}" start="{t}" stale="{s}">'
       '<point lat="{lat:.6f}" lon="{lon:.6f}" hae="0.0" ce="9999999.0" le="9999999.0"/>'
       '<detail><contact callsign="{cs}"/><__group name="Cyan" role="Team Member"/>'
       '<track course="{crs:.1f}" speed="1.0"/></detail></event>')

def iso(ts): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(ts)) + '.000Z'

ap = argparse.ArgumentParser()
ap.add_argument('--host', default='127.0.0.1'); ap.add_argument('--port', type=int, default=14242)
ap.add_argument('--count', type=int, default=200); ap.add_argument('--hz', type=float, default=1.0)
ap.add_argument('--secs', type=float, default=0); ap.add_argument('--prefix', default='COTNAT')
a = ap.parse_args()

started = time.time(); tick = 0; sent = 0; period = 1.0 / a.hz
while not a.secs or time.time() - started < a.secs:
    t0 = time.time(); t, st = iso(t0), iso(t0 + 300)
    for i in range(a.count):
        ang = tick * 0.02 + i * 2 * math.pi / a.count
        lat = 35.0 + 0.02 * math.sin(ang) + (i % 10) * 0.001
        lon = -106.0 + 0.02 * math.cos(ang) + (i // 10) * 0.001
        uid = '%s-%03d' % (a.prefix, i)
        # ATAK's TCP input frames one event per connection.
        c = socket.create_connection((a.host, a.port), timeout=5)
        c.sendall(TPL.format(uid=uid, t=t, s=st, lat=lat, lon=lon, cs=uid, crs=(ang*57.3)%360).encode())
        c.shutdown(socket.SHUT_WR); c.close()
        sent += 1
        if a.count > 1: time.sleep(period / a.count * 0.8)
    tick += 1
    print('tick %d sent=%d' % (tick, sent), flush=True)
    left = period - (time.time() - t0)
    if left > 0: time.sleep(left)

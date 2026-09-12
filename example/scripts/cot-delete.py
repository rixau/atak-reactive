#!/usr/bin/env python3
"""Remove the markers cot-load.py created: one t-x-d-d (force delete) event per
uid, so the map is clean for the next run.

    ./cot-delete.py <prefix> <count> [host] [port]
"""
import socket, time, sys
prefix, count = sys.argv[1], int(sys.argv[2])
host = sys.argv[3] if len(sys.argv) > 3 else '127.0.0.1'
port = int(sys.argv[4]) if len(sys.argv) > 4 else 14242
def iso(t): return time.strftime('%Y-%m-%dT%H:%M:%S', time.gmtime(t)) + '.000Z'
TPL = ('<?xml version="1.0"?><event version="2.0" uid="DEL-{u}" type="t-x-d-d" how="h-g-i-g-o" time="{t}" start="{t}" stale="{s}">'
       '<point lat="0" lon="0" hae="0" ce="9999999" le="9999999"/>'
       '<detail><link uid="{u}" relation="none" type="none"/><__forcedelete/></detail></event>')
n = time.time()
for i in range(count):
    u = '%s-%03d' % (prefix, i)
    c = socket.create_connection((host, port), timeout=5)
    c.sendall(TPL.format(u=u, t=iso(n), s=iso(n + 60)).encode()); c.shutdown(socket.SHUT_WR); c.close()
    time.sleep(0.005)
print('sent', count, 'deletes for', prefix)

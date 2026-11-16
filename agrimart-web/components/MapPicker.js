"use client";

import { useEffect, useRef, useState } from "react";

const KEY = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
const SCRIPT_ATTR = "data-agrimart-google-maps";
const CALLBACK = "__agrimartGoogleMapsReady";
const STORE = { lat: 13.177, lng: 121.279 };

let mapsPromise = null;

function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("Maps need a browser."));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.querySelector(`script[${SCRIPT_ATTR}]`);
    const fail = () => {
      delete window[CALLBACK];
      reject(new Error("Google Maps could not load. Check the Demo Key and internet connection."));
    };
    if (script) {
      script.addEventListener("error", fail, { once: true });
      window[CALLBACK] = () => window.google?.maps ? resolve(window.google.maps) : fail();
      return;
    }

    window[CALLBACK] = () => window.google?.maps ? resolve(window.google.maps) : fail();
    const nextScript = document.createElement("script");
    nextScript.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&callback=${CALLBACK}`;
    nextScript.async = true;
    nextScript.defer = true;
    nextScript.setAttribute(SCRIPT_ATTR, "1");
    nextScript.addEventListener("error", fail, { once: true });
    document.head.appendChild(nextScript);
  }).catch((error) => {
    mapsPromise = null;
    throw error;
  });

  return mapsPromise;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function openStreetMapEmbed(latitude, longitude, zoom) {
  const delta = 0.18 / (2 ** Math.max(0, zoom - 10));
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta]
    .map((value) => value.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
}

/** Uses the Google Maps Demo Key for an interactive pin; falls back to OSM without a key. */
export default function MapPicker({
  latitude,
  longitude,
  onChange,
  height = 260,
  zoom = 16,
  readOnly = false,
  fallbackQuery = "",
  title = "Delivery map",
}) {
  const lat = toNumber(latitude);
  const lng = toNumber(longitude);
  const hasPin = lat !== null && lng !== null;
  const center = hasPin ? { lat, lng } : STORE;
  const interactive = Boolean(KEY) && typeof onChange === "function" && !readOnly;
  const [mapState, setMapState] = useState(KEY ? "loading" : "fallback");
  const holder = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!KEY) return undefined;
    let cancelled = false;

    loadGoogleMaps().then((maps) => {
      if (cancelled || !holder.current) return;
      const map = new maps.Map(holder.current, {
        center,
        zoom: hasPin ? zoom : 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      mapRef.current = map;

      const marker = new maps.Marker({
        map,
        position: center,
        draggable: interactive,
        title: readOnly ? "Latest reported location" : "Delivery location pin",
      });
      markerRef.current = marker;

      const emit = (point) => {
        if (point && onChangeRef.current) {
          onChangeRef.current(point.lat().toFixed(6), point.lng().toFixed(6));
        }
      };
      if (interactive) {
        marker.addListener("dragend", () => emit(marker.getPosition()));
        map.addListener("click", (event) => {
          if (!event.latLng) return;
          marker.setPosition(event.latLng);
          map.panTo(event.latLng);
          emit(event.latLng);
        });
      }
      setMapState("ready");
    }).catch(() => {
      if (!cancelled) setMapState("fallback");
    });

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
      if (holder.current) holder.current.innerHTML = "";
    };
    // Create the map once per interactive/read-only mode; pin changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, readOnly]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setPosition(center);
    map.panTo(center);
  }, [lat, lng]);

  const mapHref = hasPin
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery || "Poblacion, Victoria, Oriental Mindoro")}`;

  return (
    <div className="map-wrap">
      {KEY && mapState !== "fallback" ? (
        <div
          ref={holder}
          className="map-canvas"
          style={{ height, minHeight: height }}
          role="application"
          aria-label={interactive ? "Delivery pin map. Drag the marker or click the map to set the location." : "Map showing the latest delivery location."}
        />
      ) : (
        <iframe
          title={title}
          src={openStreetMapEmbed(center.lat, center.lng, hasPin ? zoom : 13)}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ height }}
        />
      )}
      <p className="form-note" style={{ margin: "8px 12px" }}>
        {KEY && mapState === "loading" ? "Loading Google Maps… " : null}
        {interactive && mapState === "ready" ? "Drag the pin or click the map to set your delivery location. " : null}
        {interactive && mapState === "fallback" ? "Google Maps is unavailable; use your device location or enter coordinates below. " : null}
        {!KEY && interactive ? "Using OpenStreetMap. Use your device location or enter coordinates below. " : null}
        {mapState === "fallback" || !KEY ? "Map data © OpenStreetMap contributors. " : null}
        <a href={mapHref} target="_blank" rel="noreferrer">Open in Google Maps</a>
      </p>
    </div>
  );
}

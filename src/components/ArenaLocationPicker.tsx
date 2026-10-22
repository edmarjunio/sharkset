import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, Navigation, CheckCircle2, Loader2, Map as MapIcon, Compass } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface ArenaLocationValue {
  cep: string;
  address: string;
  city: string;
  state: string;
  lat?: number;
  lng?: number;
}

interface Props {
  value: ArenaLocationValue;
  onChange: (val: ArenaLocationValue) => void;
}

type TabMode = 'cep' | 'search' | 'map';

export const ArenaLocationPicker: React.FC<Props> = ({ value, onChange }) => {
  const [mode, setMode] = useState<TabMode>('cep');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }>>([]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Default coordinate: Mineiros, GO (-17.5684, -52.5811) or Brazil center if empty
  const currentLat = value.lat && !isNaN(value.lat) ? value.lat : -17.5684;
  const currentLng = value.lng && !isNaN(value.lng) ? value.lng : -52.5811;

  // Custom modern SVG pin
  const customPinIcon = L.divIcon({
    className: 'shark-map-pin',
    html: `
      <div style="transform: translate(-50%, -100%);">
        <div style="background: linear-gradient(135deg, #FF6B00 0%, #FF8533 100%); width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(255, 107, 0, 0.6); border: 2.5px solid #ffffff;">
          <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 13px;">📍</div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });

  // Reverse geocode lat/lng to fill address
  const handleReverseGeocode = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    setFeedback('Obtendo endereço pelo mapa…');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } }
      );
      if (!res.ok) throw new Error('Não foi possível geolocalizar.');
      const data = await res.json();
      const addr = data.address || {};

      const road = addr.road || addr.pedestrian || addr.street || '';
      const houseNumber = addr.house_number ? `, ${addr.house_number}` : '';
      const suburb = addr.suburb || addr.neighbourhood || '';
      const city = addr.city || addr.town || addr.municipality || addr.village || value.city;
      const state = (addr.state_code || addr.state || value.state || '').toUpperCase().slice(0, 2);
      const cep = (addr.postcode || value.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');

      const builtAddress = [road ? `${road}${houseNumber}` : '', suburb].filter(Boolean).join(', ') || data.display_name.split(',')[0];

      onChange({
        ...value,
        address: builtAddress || value.address,
        city: city || value.city,
        state: state.length === 2 ? state : value.state,
        cep: cep || value.cep,
        lat,
        lng,
      });
      setFeedback('Localização selecionada no mapa com sucesso!');
    } catch {
      onChange({ ...value, lat, lng });
      setFeedback('Coordenadas salvas.');
    } finally {
      setLoading(false);
    }
  }, [value, onChange]);

  // Initialize or update Leaflet map when tab is 'map'
  useEffect(() => {
    if (mode !== 'map' || !mapContainerRef.current) return;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: value.lat ? 16 : 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([currentLat, currentLng], {
        icon: customPinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        handleReverseGeocode(pos.lat, pos.lng);
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        handleReverseGeocode(e.latlng.lat, e.latlng.lng);
      });

      leafletMapRef.current = map;
      markerRef.current = marker;
    } else {
      leafletMapRef.current.setView([currentLat, currentLng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLng]);
      }
    }

    const timer = setTimeout(() => {
      leafletMapRef.current?.invalidateSize();
    }, 200);

    return () => clearTimeout(timer);
  }, [mode, currentLat, currentLng, customPinIcon, handleReverseGeocode, value.lat]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // 1. Search by CEP
  const handleCepSearch = async (cepInput: string) => {
    const cleanCep = cepInput.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoading(true);
    setFeedback('Consultando CEP no ViaCEP…');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setFeedback('CEP não encontrado.');
        return;
      }

      const formattedAddress = [data.logradouro, data.bairro].filter(Boolean).join(', ');
      const newCity = data.localidade || value.city;
      const newState = data.uf || value.state;

      // Geocode city/address to get lat/lng
      let lat = value.lat;
      let lng = value.lng;
      try {
        const geoQuery = encodeURIComponent(`${data.logradouro || ''}, ${data.bairro || ''}, ${newCity}, ${newState}, Brasil`);
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${geoQuery}&limit=1`);
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          lat = parseFloat(geoData[0].lat);
          lng = parseFloat(geoData[0].lon);
        }
      } catch {
        // fallback silently
      }

      onChange({
        ...value,
        cep: cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2'),
        address: formattedAddress || value.address,
        city: newCity,
        state: newState,
        lat,
        lng,
      });

      setFeedback(`Endereço localizado: ${newCity} - ${newState}`);
    } catch {
      setFeedback('Erro ao consultar CEP. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Search by Address Query
  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setFeedback('Pesquisando endereços…');
    setSearchResults([]);
    try {
      const q = encodeURIComponent(`${searchQuery}, Brasil`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&addressdetails=1&limit=5`, {
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' },
      });
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setFeedback('Nenhum endereço encontrado para essa busca.');
      } else {
        setSearchResults(data);
        setFeedback(`${data.length} locais encontrados. Clique no endereço correto.`);
      }
    } catch {
      setFeedback('Erro na busca de endereço.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSearchResult = (item: typeof searchResults[0]) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const addr = item.address || {};

    const road = addr.road || addr.street || '';
    const suburb = addr.suburb || addr.neighbourhood || '';
    const city = addr.city || addr.town || addr.municipality || value.city;
    const state = (addr.state_code || addr.state || value.state || '').toUpperCase().slice(0, 2);
    const cep = (addr.postcode || value.cep || '').replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');

    const address = [road, suburb].filter(Boolean).join(', ') || item.display_name.split(',')[0];

    onChange({
      ...value,
      address: address || value.address,
      city: city || value.city,
      state: state.length === 2 ? state : value.state,
      cep: cep || value.cep,
      lat,
      lng,
    });

    setSearchResults([]);
    setSearchQuery('');
    setFeedback('Localização selecionada com sucesso!');
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-[#031326] border border-cyan-800/60 text-white">
      {/* Tab selection */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-cyan-900/60">
        <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <MapPin size={14} className="text-amber-400" />
          Definir Localização da Arena
        </span>
        <div className="flex items-center gap-1 bg-[#061e38] p-1 rounded-xl border border-cyan-700/50">
          <button
            type="button"
            onClick={() => setMode('cep')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'cep' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            CEP
          </button>
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'search' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Buscar Endereço
          </button>
          <button
            type="button"
            onClick={() => setMode('map')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
              mode === 'map' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <MapIcon size={12} />
            <span>Mapa</span>
          </button>
        </div>
      </div>

      {/* Tab 1: CEP */}
      {mode === 'cep' && (
        <div className="space-y-2">
          <label className="block text-[11px] text-slate-300 font-semibold">
            Digite o CEP da Arena (busca automática de rua, bairro, cidade e estado):
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={9}
              value={value.cep}
              placeholder="00000-000"
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '');
                const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5, 8)}` : raw;
                onChange({ ...value, cep: formatted });
                if (raw.length === 8) handleCepSearch(raw);
              }}
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 font-mono"
            />
            <button
              type="button"
              disabled={loading || value.cep.replace(/\D/g, '').length !== 8}
              onClick={() => handleCepSearch(value.cep)}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Buscar</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Search */}
      {mode === 'search' && (
        <div className="space-y-2">
          <label className="block text-[11px] text-slate-300 font-semibold">
            Pesquise pelo nome da rua, praça ou ponto de referência:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                void handleAddressSearch();
              }}
              placeholder="Ex: Av. Brasil 500, Centro, Mineiros - GO"
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              disabled={loading || !searchQuery.trim()}
              onClick={() => void handleAddressSearch()}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Pesquisar</span>
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSearchResult(item)}
                  className="w-full text-left p-2.5 rounded-xl bg-[#061f3b] hover:bg-cyan-900/60 border border-cyan-800/60 text-xs text-slate-200 hover:text-white transition-all cursor-pointer flex items-start gap-2"
                >
                  <MapPin size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <span className="truncate">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Interactive Leaflet Map */}
      {mode === 'map' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>Clique ou arraste o pin no mapa para posicionar a arena:</span>
            {loading && <span className="text-cyan-400 inline-flex items-center gap-1 font-bold"><Loader2 size={12} className="animate-spin" /> Atualizando…</span>}
          </div>
          <div
            ref={mapContainerRef}
            className="w-full h-56 rounded-2xl border border-cyan-700/60 overflow-hidden relative shadow-inner z-0"
          />
        </div>
      )}

      {/* Status / feedback line */}
      {feedback && (
        <p className="text-[11px] text-cyan-300 font-medium flex items-center gap-1.5">
          <Compass size={12} className="text-amber-400 shrink-0" />
          <span>{feedback}</span>
        </p>
      )}

      {/* Resulting filled fields */}
      <div className="pt-2 border-t border-cyan-900/60 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="sm:col-span-2">
          <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Endereço Completo</label>
          <input
            type="text"
            required
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="Rua, número e bairro"
            className="w-full px-3 py-1.5 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">Cidade</label>
            <input
              type="text"
              required
              value={value.city}
              onChange={(e) => onChange({ ...value, city: e.target.value })}
              placeholder="Cidade"
              className="w-full px-3 py-1.5 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase mb-0.5">UF</label>
            <input
              type="text"
              required
              maxLength={2}
              value={value.state}
              onChange={(e) => onChange({ ...value, state: e.target.value.toUpperCase() })}
              placeholder="UF"
              className="w-full px-3 py-1.5 rounded-xl bg-[#05182C] border border-cyan-700/60 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>
      </div>

      {value.lat && value.lng && (
        <div className="flex items-center justify-between text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-700/40 px-3 py-1.5 rounded-xl">
          <span className="flex items-center gap-1 font-bold">
            <CheckCircle2 size={12} /> Localização com coordenadas GPS ativas
          </span>
          <span className="font-mono text-slate-300">
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
};

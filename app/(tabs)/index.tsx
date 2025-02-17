import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Text, TextInput, Image, Platform, Animated, TouchableWithoutFeedback, Switch, Keyboard, Linking } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Menu, CreditCard, Wallet, Timer, Gift, HelpCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

const INITIAL_REGION = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

const GOOGLE_PLACES_API_KEY = 'AIzaSyBsysfyl2Ma5AeVG_lFUWimKQx0EgYEnis';

const TAXI_TYPES = [
  { 
    id: 'sari', 
    name: 'Sarı Taksi',
    image: require('../../assets/images/saritaksi.png'),
    basePrice: 42.00,
    pricePerKm: 28.00,
    minPrice: 135.00
  },
  { 
    id: 'turkuaz', 
    name: 'Turkuaz Taksi',
    image: require('../../assets/images/turkuaztaksi.png'),
    basePrice: 46.58,
    pricePerKm: 31.05,
    minPrice: 155.25
  },
  { 
    id: 'vip', 
    name: 'VIP Taksi',
    image: require('../../assets/images/viptaksi.png'),
    basePrice: 68.85,
    pricePerKm: 45.90,
    minPrice: 229.50
  },
  { 
    id: 'xl', 
    name: '8+1 Taksi',
    image: require('../../assets/images/8+1taksi.png'),
    basePrice: 52.65,
    pricePerKm: 35.10,
    minPrice: 175.50
  }
];

const PAYMENT_METHODS = [
  { id: 'cash', name: 'Nakit', icon: Wallet },
  { id: 'card', name: 'Kredi Kartı', icon: CreditCard },
];

const DRAWER_WIDTH = 300;

const TIP_OPTIONS = [
  { value: 50, label: '50 TL' },
  { value: 100, label: '100 TL' },
  { value: 150, label: '150 TL' },
];

export default function HomeScreen() {
  const { user } = useAuthStore();
  const [location, setLocation] = useState(null);
  const [selectedTaxi, setSelectedTaxi] = useState('sari');
  const [selectedPayment, setSelectedPayment] = useState('cash');
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTaxiMeterEnabled, setIsTaxiMeterEnabled] = useState(false);
  const [isTipEnabled, setIsTipEnabled] = useState(false);
  const [selectedTip, setSelectedTip] = useState(null);
  const [routeDistance, setRouteDistance] = useState(null);
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const overlayAnimation = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  useEffect(() => {
    if (!isTipEnabled) {
      setSelectedTip(null);
    }
  }, [isTipEnabled]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  const toggleDrawer = () => {
    const toValue = isDrawerOpen ? 0 : 1;
    
    if (!isDrawerOpen) {
      setIsDrawerOpen(true);
    }

    Animated.parallel([
      Animated.timing(drawerAnimation, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnimation, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    });
  };

  const drawerTranslateX = drawerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [DRAWER_WIDTH, 0],
  });

  const overlayOpacity = overlayAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const calculateFare = (taxiType, distance) => {
    const taxi = TAXI_TYPES.find(t => t.id === taxiType);
    if (!taxi || !distance) return null;

    const fare = taxi.basePrice + (distance * taxi.pricePerKm);
    return Math.max(fare, taxi.minPrice);
  };

  const getRouteDirections = async (startLoc, destinationLoc) => {
    try {
      if (!startLoc || !destinationLoc) {
        console.error('Invalid locations provided');
        return;
      }

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${startLoc.latitude},${startLoc.longitude}&destination=${destinationLoc.latitude},${destinationLoc.longitude}&key=${GOOGLE_PLACES_API_KEY}`
      );
      const data = await response.json();

      if (data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points;
        const decodedPoints = decodePolyline(points);
        setRouteCoordinates(decodedPoints);

        const distanceInMeters = data.routes[0].legs[0].distance.value;
        const distanceInKm = distanceInMeters / 1000;
        setRouteDistance(distanceInKm);

        const coordinates = [
          { latitude: startLoc.latitude, longitude: startLoc.longitude },
          { latitude: destinationLoc.latitude, longitude: destinationLoc.longitude }
        ];
        
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    } catch (error) {
      console.error('Error getting directions:', error);
    }
  };

  const decodePolyline = (encoded) => {
    const points = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let shift = 0, result = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat * 1e-5,
        longitude: lng * 1e-5,
      });
    }
    return points;
  };

  const searchPlaces = async (query) => {
    if (query.length > 2) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query
          )}&key=${GOOGLE_PLACES_API_KEY}&language=tr&components=country:tr`
        );
        const data = await response.json();
        if (data.predictions) {
          setSearchResults(data.predictions);
        }
      } catch (error) {
        console.error('Error searching places:', error);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handlePlaceSelect = async (placeId, description) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_PLACES_API_KEY}&language=tr`
      );
      const data = await response.json();
      
      if (data.result && location) {
        const { lat, lng } = data.result.geometry.location;
        const destination = {
          latitude: lat,
          longitude: lng,
          description: description,
        };
        
        const startLoc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        await getRouteDirections(startLoc, destination);
        
        setSelectedDestination(destination);
        setSearchQuery(description);
        setSearchResults([]);

        setTimeout(() => {
          mapRef.current?.fitToCoordinates([startLoc, destination], {
            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
            animated: true,
          });
        }, 100);
      }
    } catch (error) {
      console.error('Error getting place details:', error);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleHelp = () => {
    Linking.openURL('tel:+905555555555');
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'ios' ? PROVIDER_DEFAULT : PROVIDER_DEFAULT}
          initialRegion={INITIAL_REGION}
          region={
            selectedDestination
              ? {
                  latitude: selectedDestination.latitude,
                  longitude: selectedDestination.longitude,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                }
              : location
              ? {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.0922,
                  longitudeDelta: 0.0421,
                }
              : INITIAL_REGION
          }
        >
          {location && (
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Konumunuz"
            />
          )}
          {selectedDestination && (
            <Marker
              coordinate={{
                latitude: selectedDestination.latitude,
                longitude: selectedDestination.longitude,
              }}
              title={selectedDestination.description}
            />
          )}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={6}
              strokeColor="#0e1d46"
            />
          )}
        </MapView>

        {isDrawerOpen && (
          <TouchableWithoutFeedback onPress={toggleDrawer}>
            <Animated.View
              style={[
                styles.overlay,
                {
                  opacity: overlayOpacity,
                },
              ]}
            />
          </TouchableWithoutFeedback>
        )}

        <Animated.View
          style={[
            styles.drawer,
            {
              transform: [{ translateX: drawerTranslateX }],
            },
          ]}>
          <SafeAreaView style={styles.drawerContent}>
            <Text style={styles.drawerTitle}>
              İyi Günler,{'\n'}
              <Text style={styles.drawerUsername}>{user?.name || 'Misafir'}</Text>
            </Text>
            <TouchableOpacity 
              style={styles.drawerItem}
              onPress={() => {
                toggleDrawer();
                router.push('/(tabs)/account');
              }}
            >
              <Text style={styles.drawerItemText}>Hesabım</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem}>
              <Text style={styles.drawerItemText}>Geçmiş Yolculuklarım</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem}>
              <Text style={styles.drawerItemText}>Bildirimlerim</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.drawerItem}>
              <Text style={styles.drawerItemText}>Duyurular</Text>
            </TouchableOpacity>
            
            <View style={styles.helpSection}>
              <TouchableOpacity 
                style={styles.helpButton}
                onPress={handleHelp}
              >
                <HelpCircle size={20} color="#0e1d46" />
                <Text style={styles.helpButtonText}>Yardım</Text>
              </TouchableOpacity>
              <Text style={styles.helpText}>7/24 Müşteri Hizmetleri</Text>
            </View>
          </SafeAreaView>
        </Animated.View>

        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Nereye gitmek istersiniz?"
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchPlaces(text);
                }}
              />
            </View>
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map((result) => (
                  <TouchableOpacity
                    key={result.place_id}
                    style={styles.resultItem}
                    onPress={() => handlePlaceSelect(result.place_id, result.description)}
                  >
                    <Text style={styles.resultText}>{result.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={toggleDrawer}>
            <View style={styles.menuButtonCircle}>
              <Menu size={20} color="#0e1d46" />
            </View>
          </TouchableOpacity>
        </View>

        <SafeAreaView style={styles.bottomOverlay} edges={['bottom']}>
          <View style={styles.taxiTypes}>
            {TAXI_TYPES.map((taxi) => {
              const estimatedFare = routeDistance ? calculateFare(taxi.id, routeDistance) : null;
              
              return (
                <TouchableOpacity
                  key={taxi.id}
                  style={[
                    styles.taxiOption,
                    selectedTaxi === taxi.id && styles.selectedTaxi,
                  ]}
                  onPress={() => setSelectedTaxi(taxi.id)}
                >
                  <Image source={taxi.image} style={styles.taxiImage} />
                  <Text style={[
                    styles.taxiName,
                    selectedTaxi === taxi.id && styles.selectedTaxiText
                  ]}>
                    {taxi.name}
                  </Text>
                  <Text style={[
                    styles.taxiPrice,
                    selectedTaxi === taxi.id && styles.selectedTaxiText
                  ]}>
                    {estimatedFare ? `₺${estimatedFare.toFixed(2)}` : `₺${taxi.minPrice.toFixed(2)}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.paymentMethods}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  selectedPayment === method.id && styles.selectedPayment,
                ]}
                onPress={() => setSelectedPayment(method.id)}
              >
                <method.icon
                  size={20}
                  color={selectedPayment === method.id ? '#fff' : '#666'}
                  style={styles.paymentIcon}
                />
                <Text style={[
                  styles.paymentText,
                  selectedPayment === method.id && styles.selectedPaymentText
                ]}>
                  {method.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.taxiMeterContainer}>
            <View style={styles.taxiMeterContent}>
              <Timer size={16} color="#666" style={styles.taxiMeterIcon} />
              <Text style={styles.taxiMeterText}>Taksimetreni aç gel</Text>
            </View>
            <Switch
              value={isTaxiMeterEnabled}
              onValueChange={setIsTaxiMeterEnabled}
              trackColor={{ false: '#e0e0e0', true: '#0e1d46' }}
              thumbColor={isTaxiMeterEnabled ? '#fff' : '#fff'}
              ios_backgroundColor="#e0e0e0"
              style={styles.taxiMeterSwitch}
            />
          </View>

          <View style={styles.tipContainer}>
            <View style={styles.tipHeader}>
              <View style={styles.tipTitleContainer}>
                <Gift size={16} color="#666" style={styles.tipIcon} />
                <Text style={styles.tipTitle}>Bahşiş</Text>
              </View>
              <Switch
                value={isTipEnabled}
                onValueChange={setIsTipEnabled}
                trackColor={{ false: '#e0e0e0', true: '#0e1d46' }}
                thumbColor={isTipEnabled ? '#fff' : '#fff'}
                ios_backgroundColor="#e0e0e0"
                style={styles.tipSwitch}
              />
            </View>
            {isTipEnabled && (
              <View style={styles.tipOptions}>
                {TIP_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.tipOption,
                      selectedTip === option.value && styles.selectedTip,
                    ]}
                    onPress={() => setSelectedTip(option.value === selectedTip ? null : option.value)}
                  >
                    <Text
                      style={[
                        styles.tipText,
                        selectedTip === option.value && styles.selectedTipText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={[
              styles.callButton,
              !selectedDestination && styles.callButtonDisabled
            ]}
            disabled={!selectedDestination}
          >
            <Text style={styles.callButtonText}>
              Taksi Çağır {selectedTip ? ` (+${selectedTip} TL Bahşiş)` : ''}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 360,
  },
  searchWrapper: {
    position: 'absolute',
    bottom: 385,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    position: 'relative',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: '#000',
  },
  searchResults: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    maxHeight: 300,
    zIndex: 10,
  },
  resultItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultText: {
    fontSize: 14,
    color: '#333',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 5,
  },
  taxiTypes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  taxiOption: {
    width: '23%',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  selectedTaxi: {
    backgroundColor: '#0e1d46',
  },
  taxiImage: {
    width: 40,
    height: 40,
    marginBottom: 4,
    resizeMode: 'contain',
  },
  taxiName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
    textAlign: 'center',
  },
  taxiPrice: {
    fontSize: 11,
    color: '#666',
  },
  selectedTaxiText: {
    color: '#fff',
  },
  paymentMethods: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  selectedPayment: {
    backgroundColor: '#0e1d46',
  },
  paymentIcon: {
    marginRight: 4,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedPaymentText: {
    color: '#fff',
  },
  taxiMeterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 8,
    paddingLeft: 12,
    borderRadius: 12,
    height: 40,
  },
  taxiMeterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taxiMeterIcon: {
    marginRight: 2,
  },
  taxiMeterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  taxiMeterSwitch: {
    transform: [{ scale: 0.8 }],
  },
  tipContainer: {
    marginHorizontal: 16,
    marginTop: 8,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    padding: 8,
    paddingLeft: 12,
    borderRadius: 12,
    height: 40,
  },
  tipTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipIcon: {
    marginRight: 2,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  tipSwitch: {
    transform: [{ scale: 0.8 }],
  },
  tipOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tipOption: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectedTip: {
    backgroundColor: '#0e1d46',
  },
  tipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedTipText: {
    color: '#fff',
  },
  callButton: {
    backgroundColor: '#0e1d46',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  callButtonDisabled: {
    backgroundColor: '#ccc',
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuButton: {
    width: 40,
    height: 40,
    zIndex: 10,
  },
  menuButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 15,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: 'white',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawerContent: {
    flex: 1,
    padding: 20,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    marginTop: 20,
    color: '#0e1d46',
  },
  drawerUsername: {
    color: '#333',
  },
  drawerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  drawerItemText: {
    fontSize: 16,
    color: '#333',
  },
  logoutButton: {
    marginTop: 'auto',
    borderBottomWidth: 0,
  },
  logoutText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '600',
  },
  helpSection: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  helpButtonText: {
    fontSize: 16,
    color: '#0e1d46',
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
});
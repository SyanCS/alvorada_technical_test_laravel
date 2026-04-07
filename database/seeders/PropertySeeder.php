<?php

namespace Database\Seeders;

use App\Models\Note;
use App\Models\Property;
use App\Models\PropertyFeature;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class PropertySeeder extends Seeder
{
    public function run(): void
    {
        $properties = $this->getProperties();
        $brokerNotes = $this->getBrokerNotes();
        $featurePresets = $this->getFeaturePresets();

        $this->command->info('Seeding '.count($properties).' properties...');
        $bar = $this->command->getOutput()->createProgressBar(count($properties));
        $bar->start();

        foreach ($properties as $i => $entry) {
            $property = Property::create([
                'name' => $entry['name'],
                'address' => $entry['address'],
                'latitude' => $entry['lat'],
                'longitude' => $entry['lon'],
                'extra_field' => [
                    'display_name' => $entry['address'],
                    'type' => 'commercial',
                    'source' => 'seed',
                ],
            ]);

            $noteCount = rand(1, 4);
            $selectedNotes = array_rand(array_flip($brokerNotes), $noteCount);
            if (! is_array($selectedNotes)) {
                $selectedNotes = [$selectedNotes];
            }

            foreach ($selectedNotes as $note) {
                Note::create([
                    'property_id' => $property->id,
                    'note' => $note,
                ]);
            }

            $preset = $featurePresets[$i % count($featurePresets)];
            PropertyFeature::create([
                'property_id' => $property->id,
                'near_subway' => $preset['near_subway'],
                'needs_renovation' => $preset['needs_renovation'],
                'parking_available' => $preset['parking_available'],
                'has_elevator' => $preset['has_elevator'],
                'estimated_capacity_people' => $preset['estimated_capacity_people'],
                'floor_level' => $preset['floor_level'],
                'condition_rating' => $preset['condition_rating'],
                'recommended_use' => $preset['recommended_use'],
                'amenities' => $preset['amenities'],
                'confidence_score' => $preset['confidence_score'],
                'source_notes_count' => $noteCount,
                'raw_ai_response' => ['model' => 'gpt-4o', 'prompt_version' => 'v2'],
                'extracted_at' => Carbon::now()->subDays(rand(0, 30)),
            ]);

            $bar->advance();
        }

        $bar->finish();
        $this->command->newLine();
        $this->command->info('Done! Created '.count($properties).' properties.');
    }

    private function getFeaturePresets(): array
    {
        return [
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => false, 'has_elevator' => true,  'estimated_capacity_people' => 350, 'floor_level' => 22, 'condition_rating' => 5, 'recommended_use' => 'office',     'amenities' => ['lobby', 'security', 'conference-rooms', 'gym'],           'confidence_score' => 0.95],
            ['near_subway' => true,  'needs_renovation' => true,  'parking_available' => false, 'has_elevator' => true,  'estimated_capacity_people' => 120, 'floor_level' => 8,  'condition_rating' => 2, 'recommended_use' => 'retail',     'amenities' => ['lobby', 'loading-dock'],                                   'confidence_score' => 0.82],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 50,  'floor_level' => 1,  'condition_rating' => 4, 'recommended_use' => 'restaurant', 'amenities' => ['courtyard', 'ev-charging'],                                'confidence_score' => 0.91],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 200, 'floor_level' => 1,  'condition_rating' => 3, 'recommended_use' => 'warehouse',  'amenities' => ['loading-dock', 'security'],                                'confidence_score' => 0.88],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => true,  'estimated_capacity_people' => 500, 'floor_level' => 15, 'condition_rating' => 5, 'recommended_use' => 'office',     'amenities' => ['lobby', 'security', 'gym', 'rooftop', 'conference-rooms'], 'confidence_score' => 0.97],
            ['near_subway' => false, 'needs_renovation' => true,  'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 30,  'floor_level' => 2,  'condition_rating' => 2, 'recommended_use' => 'retail',     'amenities' => ['bike-storage'],                                            'confidence_score' => 0.74],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => false, 'has_elevator' => true,  'estimated_capacity_people' => 80,  'floor_level' => 5,  'condition_rating' => 4, 'recommended_use' => 'medical',    'amenities' => ['lobby', 'security', 'ev-charging'],                        'confidence_score' => 0.89],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => true,  'estimated_capacity_people' => 250, 'floor_level' => 10, 'condition_rating' => 4, 'recommended_use' => 'mixed-use',  'amenities' => ['lobby', 'rooftop', 'co-working', 'bike-storage'],          'confidence_score' => 0.93],
            ['near_subway' => true,  'needs_renovation' => true,  'parking_available' => false, 'has_elevator' => false, 'estimated_capacity_people' => 40,  'floor_level' => 3,  'condition_rating' => 1, 'recommended_use' => 'studio',     'amenities' => ['courtyard'],                                               'confidence_score' => 0.68],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 150, 'floor_level' => 1,  'condition_rating' => 3, 'recommended_use' => 'retail',     'amenities' => ['loading-dock', 'ev-charging', 'security'],                 'confidence_score' => 0.85],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => true,  'estimated_capacity_people' => 400, 'floor_level' => 18, 'condition_rating' => 5, 'recommended_use' => 'tech',       'amenities' => ['lobby', 'gym', 'rooftop', 'co-working', 'bike-storage'],   'confidence_score' => 0.96],
            ['near_subway' => false, 'needs_renovation' => true,  'parking_available' => false, 'has_elevator' => false, 'estimated_capacity_people' => 20,  'floor_level' => 1,  'condition_rating' => 2, 'recommended_use' => 'restaurant', 'amenities' => ['courtyard'],                                               'confidence_score' => 0.71],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => true,  'estimated_capacity_people' => 300, 'floor_level' => 12, 'condition_rating' => 4, 'recommended_use' => 'office',     'amenities' => ['lobby', 'security', 'conference-rooms', 'ev-charging'],    'confidence_score' => 0.92],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => false, 'has_elevator' => true,  'estimated_capacity_people' => 60,  'floor_level' => 6,  'condition_rating' => 3, 'recommended_use' => 'residential', 'amenities' => ['lobby', 'gym', 'bike-storage'],                            'confidence_score' => 0.84],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 100, 'floor_level' => 1,  'condition_rating' => 4, 'recommended_use' => 'retail',     'amenities' => ['loading-dock', 'security', 'ev-charging'],                 'confidence_score' => 0.90],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => true,  'estimated_capacity_people' => 180, 'floor_level' => 9,  'condition_rating' => 5, 'recommended_use' => 'medical',    'amenities' => ['lobby', 'security', 'conference-rooms'],                   'confidence_score' => 0.94],
            ['near_subway' => false, 'needs_renovation' => true,  'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 75,  'floor_level' => 2,  'condition_rating' => 1, 'recommended_use' => 'warehouse',  'amenities' => ['loading-dock'],                                            'confidence_score' => 0.66],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => false, 'has_elevator' => true,  'estimated_capacity_people' => 220, 'floor_level' => 14, 'condition_rating' => 4, 'recommended_use' => 'tech',       'amenities' => ['lobby', 'co-working', 'rooftop', 'gym'],                   'confidence_score' => 0.91],
            ['near_subway' => false, 'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => false, 'estimated_capacity_people' => 45,  'floor_level' => 1,  'condition_rating' => 3, 'recommended_use' => 'studio',     'amenities' => ['courtyard', 'bike-storage'],                               'confidence_score' => 0.79],
            ['near_subway' => true,  'needs_renovation' => false, 'parking_available' => true,  'has_elevator' => true,  'estimated_capacity_people' => 450, 'floor_level' => 25, 'condition_rating' => 5, 'recommended_use' => 'mixed-use',  'amenities' => ['lobby', 'security', 'gym', 'rooftop', 'ev-charging'],      'confidence_score' => 0.98],
        ];
    }

    private function getBrokerNotes(): array
    {
        return [
            'Great location near public transit. High foot traffic area ideal for retail.',
            'Building needs minor cosmetic updates but structure is solid. Good bones.',
            'Recently renovated lobby and common areas. Tenants very satisfied.',
            'Parking lot needs resurfacing within 2 years. Budget accordingly.',
            'Excellent cash flow property. Current tenants on long-term leases.',
            'Zoning allows mixed-use development. Potential for vertical expansion.',
            'Corner lot with great visibility. Perfect for a flagship store.',
            'HVAC system replaced in 2023. All major systems in good condition.',
            'Owner motivated to sell. Price reduced 10% from original listing.',
            'Environmental Phase I completed — no issues found.',
            'Roof replaced 3 years ago with 20-year warranty still active.',
            'Property taxes are below market average for the area.',
            'Strong rental demand in this neighborhood. Very low vacancy rates.',
            'Walking distance to university campus. Student housing potential.',
            'Near new highway interchange under construction. Value should increase.',
            'Historic district — check local preservation requirements before renovation.',
            'Fiber internet available. Good for tech tenants.',
            'Warehouse space with 18ft ceilings and loading docks. Industrial zoning.',
            'Previous tenant was a restaurant. Grease trap and hood ventilation in place.',
            'Quiet residential street but close to commercial corridor.',
            'Flood zone X — no flood insurance required.',
            'Property includes adjacent vacant lot for future expansion.',
            'Seller will carry financing for qualified buyers.',
            'CAM charges are competitive for the submarket.',
            'Building has backup generator and security system installed.',
            'ADA compliant. Elevator serves all floors.',
            'Multiple offers expected. Best and final due by end of week.',
            'Leases are triple net. Minimal landlord responsibilities.',
            'Good candidate for 1031 exchange. Stable income property.',
            'Asbestos abatement completed and documented. Clean report on file.',
            'Ideal for medical office conversion. Adequate plumbing infrastructure.',
            'Near proposed light rail station — long-term appreciation play.',
            'Current below-market rents offer significant upside at renewal.',
            'Condo conversion potential in this market.',
            'Anchor tenant just renewed for 5 years. Stable income.',
            'Seismic retrofit completed in 2022. Meets current code.',
            'Solar panels installed on roof generating income via net metering.',
            'Signage rights included. Billboard generates $2k/month.',
            'Sprinkler system throughout. Meets fire code requirements.',
            'Deed restrictions limit use to commercial only. No residential.',
        ];
    }

    private function getProperties(): array
    {
        return [
            // === New York (15) ===
            ['name' => 'Empire State Building', 'address' => '350 Fifth Avenue, New York, NY 10118', 'lat' => 40.7484, 'lon' => -73.9857],
            ['name' => 'Times Square Tower', 'address' => '1475 Broadway, New York, NY 10036', 'lat' => 40.7580, 'lon' => -73.9855],
            ['name' => 'One World Trade Center', 'address' => '285 Fulton Street, New York, NY 10007', 'lat' => 40.7127, 'lon' => -74.0134],
            ['name' => 'Rockefeller Center', 'address' => '45 Rockefeller Plaza, New York, NY 10111', 'lat' => 40.7587, 'lon' => -73.9787],
            ['name' => 'Grand Central Terminal', 'address' => '89 East 42nd Street, New York, NY 10017', 'lat' => 40.7527, 'lon' => -73.9772],
            ['name' => 'Madison Square Garden', 'address' => '4 Pennsylvania Plaza, New York, NY 10001', 'lat' => 40.7505, 'lon' => -73.9934],
            ['name' => 'Chelsea Market', 'address' => '75 Ninth Avenue, New York, NY 10011', 'lat' => 40.7424, 'lon' => -74.0061],
            ['name' => 'Flatiron Building', 'address' => '175 Fifth Avenue, New York, NY 10010', 'lat' => 40.7411, 'lon' => -73.9897],
            ['name' => 'Chrysler Building', 'address' => '405 Lexington Avenue, New York, NY 10174', 'lat' => 40.7516, 'lon' => -73.9755],
            ['name' => 'Woolworth Building', 'address' => '233 Broadway, New York, NY 10279', 'lat' => 40.7125, 'lon' => -74.0083],
            ['name' => 'SoHo Loft Space', 'address' => '568 Broadway, New York, NY 10012', 'lat' => 40.7237, 'lon' => -73.9975],
            ['name' => 'Brooklyn Navy Yard', 'address' => '63 Flushing Avenue, Brooklyn, NY 11205', 'lat' => 40.6992, 'lon' => -73.9713],
            ['name' => 'Dumbo Heights', 'address' => '77 Sands Street, Brooklyn, NY 11201', 'lat' => 40.6984, 'lon' => -73.9829],
            ['name' => 'Williamsburg Warehouse', 'address' => '475 Kent Avenue, Brooklyn, NY 11249', 'lat' => 40.7112, 'lon' => -73.9615],
            ['name' => 'Harlem Brownstone', 'address' => '220 West 135th Street, New York, NY 10030', 'lat' => 40.8163, 'lon' => -73.9456],
            // === Los Angeles (15) ===
            ['name' => 'Hollywood & Highland', 'address' => '6801 Hollywood Boulevard, Los Angeles, CA 90028', 'lat' => 34.1022, 'lon' => -118.3417],
            ['name' => 'Century City Towers', 'address' => '2049 Century Park East, Los Angeles, CA 90067', 'lat' => 34.0573, 'lon' => -118.4148],
            ['name' => 'Santa Monica Place', 'address' => '395 Santa Monica Place, Santa Monica, CA 90401', 'lat' => 34.0153, 'lon' => -118.4970],
            ['name' => 'Venice Beach Boardwalk', 'address' => '1800 Ocean Front Walk, Venice, CA 90291', 'lat' => 33.9850, 'lon' => -118.4695],
            ['name' => 'Downtown LA Arts District', 'address' => '950 East 3rd Street, Los Angeles, CA 90013', 'lat' => 34.0404, 'lon' => -118.2320],
            ['name' => 'Beverly Hills Office', 'address' => '9460 Wilshire Boulevard, Beverly Hills, CA 90212', 'lat' => 34.0693, 'lon' => -118.3977],
            ['name' => 'Culver City Studios', 'address' => '9336 Washington Boulevard, Culver City, CA 90232', 'lat' => 34.0259, 'lon' => -118.3920],
            ['name' => 'Pasadena Old Town', 'address' => '54 West Colorado Boulevard, Pasadena, CA 91105', 'lat' => 34.1459, 'lon' => -118.1500],
            ['name' => 'Silver Lake Mixed-Use', 'address' => '2900 Sunset Boulevard, Los Angeles, CA 90026', 'lat' => 34.0785, 'lon' => -118.2710],
            ['name' => 'Long Beach Port Center', 'address' => '100 West Broadway, Long Beach, CA 90802', 'lat' => 33.7701, 'lon' => -118.1937],
            ['name' => 'Glendale Galleria', 'address' => '100 West Broadway, Glendale, CA 91210', 'lat' => 34.1460, 'lon' => -118.2551],
            ['name' => 'Burbank Media Center', 'address' => '3900 West Alameda Avenue, Burbank, CA 91505', 'lat' => 34.1535, 'lon' => -118.3440],
            ['name' => 'Koreatown Plaza', 'address' => '928 South Western Avenue, Los Angeles, CA 90006', 'lat' => 34.0554, 'lon' => -118.3089],
            ['name' => 'El Segundo Tech Hub', 'address' => '888 North Douglas Street, El Segundo, CA 90245', 'lat' => 33.9210, 'lon' => -118.4000],
            ['name' => 'Westwood Village', 'address' => '1067 Broxton Avenue, Los Angeles, CA 90024', 'lat' => 34.0600, 'lon' => -118.4468],
            // === Chicago (15) ===
            ['name' => 'Willis Tower', 'address' => '233 South Wacker Drive, Chicago, IL 60606', 'lat' => 41.8789, 'lon' => -87.6359],
            ['name' => 'Merchandise Mart', 'address' => '222 Merchandise Mart Plaza, Chicago, IL 60654', 'lat' => 41.8885, 'lon' => -87.6354],
            ['name' => 'Navy Pier', 'address' => '600 East Grand Avenue, Chicago, IL 60611', 'lat' => 41.8917, 'lon' => -87.6086],
            ['name' => 'Wrigley Building', 'address' => '400 North Michigan Avenue, Chicago, IL 60611', 'lat' => 41.8898, 'lon' => -87.6248],
            ['name' => 'Tribune Tower', 'address' => '435 North Michigan Avenue, Chicago, IL 60611', 'lat' => 41.8904, 'lon' => -87.6237],
            ['name' => 'Fulton Market Loft', 'address' => '1000 West Fulton Market, Chicago, IL 60607', 'lat' => 41.8867, 'lon' => -87.6523],
            ['name' => 'Lincoln Park Retail', 'address' => '2550 North Clark Street, Chicago, IL 60614', 'lat' => 41.9295, 'lon' => -87.6437],
            ['name' => 'Wicker Park Hub', 'address' => '1521 North Milwaukee Avenue, Chicago, IL 60622', 'lat' => 41.9088, 'lon' => -87.6744],
            ['name' => 'South Loop Mixed-Use', 'address' => '1300 South Michigan Avenue, Chicago, IL 60605', 'lat' => 41.8625, 'lon' => -87.6237],
            ['name' => 'River North Gallery', 'address' => '300 West Superior Street, Chicago, IL 60654', 'lat' => 41.8959, 'lon' => -87.6368],
            ['name' => 'Logan Square Center', 'address' => '2600 North Milwaukee Avenue, Chicago, IL 60647', 'lat' => 41.9287, 'lon' => -87.6983],
            ['name' => 'Hyde Park Commercial', 'address' => '1501 East 53rd Street, Chicago, IL 60615', 'lat' => 41.7994, 'lon' => -87.5863],
            ['name' => 'Pilsen Art Space', 'address' => '1821 South Halsted Street, Chicago, IL 60608', 'lat' => 41.8571, 'lon' => -87.6468],
            ['name' => 'Evanston Tech Office', 'address' => '1603 Orrington Avenue, Evanston, IL 60201', 'lat' => 42.0473, 'lon' => -87.6816],
            ['name' => 'Oak Brook Plaza', 'address' => '1000 Oakbrook Center, Oak Brook, IL 60523', 'lat' => 41.8498, 'lon' => -87.9520],
            // === Houston (10) ===
            ['name' => 'Galleria Tower', 'address' => '2929 Allen Parkway, Houston, TX 77019', 'lat' => 29.7604, 'lon' => -95.3937],
            ['name' => 'Energy Corridor Office', 'address' => '1400 Enclave Parkway, Houston, TX 77077', 'lat' => 29.7563, 'lon' => -95.5591],
            ['name' => 'Midtown Houston Loft', 'address' => '3100 Main Street, Houston, TX 77002', 'lat' => 29.7434, 'lon' => -95.3832],
            ['name' => 'Heights Retail Strip', 'address' => '350 West 19th Street, Houston, TX 77008', 'lat' => 29.8003, 'lon' => -95.3969],
            ['name' => 'Medical Center Office', 'address' => '6624 Fannin Street, Houston, TX 77030', 'lat' => 29.7106, 'lon' => -95.3969],
            ['name' => 'Montrose Mixed-Use', 'address' => '1540 Westheimer Road, Houston, TX 77006', 'lat' => 29.7450, 'lon' => -95.3922],
            ['name' => 'Katy Freeway Complex', 'address' => '12000 Katy Freeway, Houston, TX 77079', 'lat' => 29.7802, 'lon' => -95.5426],
            ['name' => 'Sugar Land Town Center', 'address' => '2711 Town Center Boulevard, Sugar Land, TX 77479', 'lat' => 29.5927, 'lon' => -95.6218],
            ['name' => 'The Woodlands Office', 'address' => '9950 Woodloch Forest Drive, The Woodlands, TX 77380', 'lat' => 30.1627, 'lon' => -95.4613],
            ['name' => 'EaDo Warehouse', 'address' => '2401 Commerce Street, Houston, TX 77003', 'lat' => 29.7508, 'lon' => -95.3514],
            // === San Francisco (10) ===
            ['name' => 'Salesforce Tower', 'address' => '415 Mission Street, San Francisco, CA 94105', 'lat' => 37.7898, 'lon' => -122.3969],
            ['name' => 'Ferry Building', 'address' => '1 Ferry Building, San Francisco, CA 94111', 'lat' => 37.7956, 'lon' => -122.3935],
            ['name' => 'Ghirardelli Square', 'address' => '900 North Point Street, San Francisco, CA 94109', 'lat' => 37.8060, 'lon' => -122.4230],
            ['name' => 'SoMa Tech Hub', 'address' => '140 New Montgomery Street, San Francisco, CA 94105', 'lat' => 37.7867, 'lon' => -122.4000],
            ['name' => 'Mission District Loft', 'address' => '2800 Mission Street, San Francisco, CA 94110', 'lat' => 37.7524, 'lon' => -122.4184],
            ['name' => 'Marina District Retail', 'address' => '2030 Chestnut Street, San Francisco, CA 94123', 'lat' => 37.8005, 'lon' => -122.4358],
            ['name' => 'Embarcadero Center', 'address' => '1 Embarcadero Center, San Francisco, CA 94111', 'lat' => 37.7949, 'lon' => -122.3992],
            ['name' => 'Potrero Hill Office', 'address' => '1600 Mariposa Street, San Francisco, CA 94107', 'lat' => 37.7634, 'lon' => -122.3964],
            ['name' => 'Hayes Valley Storefront', 'address' => '560 Hayes Street, San Francisco, CA 94102', 'lat' => 37.7764, 'lon' => -122.4252],
            ['name' => 'Oakland Jack London Square', 'address' => '55 Harrison Street, Oakland, CA 94607', 'lat' => 37.7952, 'lon' => -122.2764],
            // === Miami (10) ===
            ['name' => 'Brickell City Centre', 'address' => '701 South Miami Avenue, Miami, FL 33131', 'lat' => 25.7650, 'lon' => -80.1929],
            ['name' => 'Wynwood Walls', 'address' => '2520 NW 2nd Avenue, Miami, FL 33127', 'lat' => 25.8010, 'lon' => -80.1994],
            ['name' => 'Miami Design District', 'address' => '140 NE 39th Street, Miami, FL 33137', 'lat' => 25.8132, 'lon' => -80.1917],
            ['name' => 'Coconut Grove Center', 'address' => '3015 Grand Avenue, Coconut Grove, FL 33133', 'lat' => 25.7281, 'lon' => -80.2421],
            ['name' => 'South Beach Retail', 'address' => '1111 Lincoln Road, Miami Beach, FL 33139', 'lat' => 25.7916, 'lon' => -80.1396],
            ['name' => 'Coral Gables Office', 'address' => '396 Alhambra Circle, Coral Gables, FL 33134', 'lat' => 25.7500, 'lon' => -80.2590],
            ['name' => 'Midtown Miami Tower', 'address' => '3401 North Miami Avenue, Miami, FL 33127', 'lat' => 25.8096, 'lon' => -80.1954],
            ['name' => 'Doral Business Park', 'address' => '8200 NW 41st Street, Doral, FL 33166', 'lat' => 25.8134, 'lon' => -80.3383],
            ['name' => 'Aventura Commerce', 'address' => '20801 Biscayne Boulevard, Aventura, FL 33180', 'lat' => 25.9564, 'lon' => -80.1433],
            ['name' => 'Little Havana Storefront', 'address' => '1600 SW 8th Street, Miami, FL 33135', 'lat' => 25.7655, 'lon' => -80.2133],
            // === Seattle (10) ===
            ['name' => 'Pike Place Market', 'address' => '85 Pike Street, Seattle, WA 98101', 'lat' => 47.6097, 'lon' => -122.3425],
            ['name' => 'Amazon Spheres', 'address' => '2021 7th Avenue, Seattle, WA 98121', 'lat' => 47.6157, 'lon' => -122.3393],
            ['name' => 'Capitol Hill Mixed-Use', 'address' => '1525 Broadway, Seattle, WA 98122', 'lat' => 47.6143, 'lon' => -122.3209],
            ['name' => 'Pioneer Square Office', 'address' => '115 Prefontaine Place South, Seattle, WA 98104', 'lat' => 47.6017, 'lon' => -122.3320],
            ['name' => 'Fremont Center', 'address' => '3601 Fremont Avenue North, Seattle, WA 98103', 'lat' => 47.6515, 'lon' => -122.3501],
            ['name' => 'Ballard Brewery District', 'address' => '5432 Ballard Avenue NW, Seattle, WA 98107', 'lat' => 47.6677, 'lon' => -122.3826],
            ['name' => 'Bellevue Square', 'address' => '575 Bellevue Square, Bellevue, WA 98004', 'lat' => 47.6153, 'lon' => -122.2040],
            ['name' => 'Redmond Tech Campus', 'address' => '15010 NE 36th Street, Redmond, WA 98052', 'lat' => 47.6421, 'lon' => -122.1337],
            ['name' => 'University District Retail', 'address' => '4507 University Way NE, Seattle, WA 98105', 'lat' => 47.6622, 'lon' => -122.3131],
            ['name' => 'South Lake Union Hub', 'address' => '400 Westlake Avenue North, Seattle, WA 98109', 'lat' => 47.6262, 'lon' => -122.3385],
            // === Boston (10) ===
            ['name' => 'Faneuil Hall', 'address' => '4 South Market Street, Boston, MA 02109', 'lat' => 42.3600, 'lon' => -71.0566],
            ['name' => 'Prudential Center', 'address' => '800 Boylston Street, Boston, MA 02199', 'lat' => 42.3474, 'lon' => -71.0824],
            ['name' => 'Seaport Innovation District', 'address' => '12 Channel Street, Boston, MA 02210', 'lat' => 42.3481, 'lon' => -71.0468],
            ['name' => 'Back Bay Office', 'address' => '200 Clarendon Street, Boston, MA 02116', 'lat' => 42.3497, 'lon' => -71.0766],
            ['name' => 'Cambridge Biotech', 'address' => '100 Technology Square, Cambridge, MA 02139', 'lat' => 42.3624, 'lon' => -71.0918],
            ['name' => 'Harvard Square Retail', 'address' => '1 Brattle Square, Cambridge, MA 02138', 'lat' => 42.3735, 'lon' => -71.1205],
            ['name' => 'Kendall Square Lab', 'address' => '245 Main Street, Cambridge, MA 02142', 'lat' => 42.3629, 'lon' => -71.0862],
            ['name' => 'South End Mixed-Use', 'address' => '500 Harrison Avenue, Boston, MA 02118', 'lat' => 42.3459, 'lon' => -71.0689],
            ['name' => 'Newbury Street Boutique', 'address' => '160 Newbury Street, Boston, MA 02116', 'lat' => 42.3517, 'lon' => -71.0756],
            ['name' => 'Somerville Assembly Row', 'address' => '399 Revolution Drive, Somerville, MA 02145', 'lat' => 42.3953, 'lon' => -71.0773],
            // === Denver (10) ===
            ['name' => 'Union Station', 'address' => '1701 Wynkoop Street, Denver, CO 80202', 'lat' => 39.7530, 'lon' => -105.0002],
            ['name' => 'LoDo Loft', 'address' => '1550 Wazee Street, Denver, CO 80202', 'lat' => 39.7525, 'lon' => -104.9994],
            ['name' => 'RiNo Art District', 'address' => '3560 Brighton Boulevard, Denver, CO 80216', 'lat' => 39.7716, 'lon' => -104.9780],
            ['name' => 'Cherry Creek Mall', 'address' => '3000 East 1st Avenue, Denver, CO 80206', 'lat' => 39.7180, 'lon' => -104.9531],
            ['name' => 'Highlands Retail', 'address' => '3500 Navajo Street, Denver, CO 80211', 'lat' => 39.7621, 'lon' => -105.0103],
            ['name' => 'Tech Center Office', 'address' => '7900 East Union Avenue, Denver, CO 80237', 'lat' => 39.6300, 'lon' => -104.8980],
            ['name' => 'Boulder Pearl Street', 'address' => '1301 Pearl Street, Boulder, CO 80302', 'lat' => 40.0175, 'lon' => -105.2797],
            ['name' => 'Aurora Town Center', 'address' => '14200 East Alameda Avenue, Aurora, CO 80012', 'lat' => 39.7107, 'lon' => -104.8063],
            ['name' => 'Lakewood Belmar', 'address' => '464 South Teller Street, Lakewood, CO 80226', 'lat' => 39.7137, 'lon' => -105.0769],
            ['name' => 'Westminster Promenade', 'address' => '10450 Town Center Drive, Westminster, CO 80021', 'lat' => 39.8847, 'lon' => -105.0672],
            // === Austin (10) ===
            ['name' => 'Congress Avenue Tower', 'address' => '100 Congress Avenue, Austin, TX 78701', 'lat' => 30.2649, 'lon' => -97.7442],
            ['name' => 'South Lamar Hub', 'address' => '1100 South Lamar Boulevard, Austin, TX 78704', 'lat' => 30.2528, 'lon' => -97.7658],
            ['name' => 'East Austin Creative', 'address' => '979 Springdale Road, Austin, TX 78702', 'lat' => 30.2621, 'lon' => -97.7028],
            ['name' => 'Domain NORTHSIDE', 'address' => '11600 Century Oaks Terrace, Austin, TX 78758', 'lat' => 30.4021, 'lon' => -97.7253],
            ['name' => 'Rainey Street District', 'address' => '80 Rainey Street, Austin, TX 78701', 'lat' => 30.2580, 'lon' => -97.7393],
            ['name' => 'Mueller Town Center', 'address' => '1201 Barbara Jordan Boulevard, Austin, TX 78723', 'lat' => 30.2977, 'lon' => -97.7056],
            ['name' => 'Round Rock Premium', 'address' => '4401 North IH-35, Round Rock, TX 78664', 'lat' => 30.5636, 'lon' => -97.6689],
            ['name' => 'Cedar Park Office', 'address' => '1890 Ranch Shopping Center, Cedar Park, TX 78613', 'lat' => 30.5123, 'lon' => -97.8264],
            ['name' => 'Bee Cave Galleria', 'address' => '12700 Hill Country Boulevard, Bee Cave, TX 78738', 'lat' => 30.3083, 'lon' => -97.9420],
            ['name' => '2nd Street District', 'address' => '200 West 2nd Street, Austin, TX 78701', 'lat' => 30.2651, 'lon' => -97.7483],
            // === Phoenix (10) ===
            ['name' => 'Camelback Corridor', 'address' => '2398 East Camelback Road, Phoenix, AZ 85016', 'lat' => 33.5088, 'lon' => -111.9803],
            ['name' => 'Scottsdale Quarter', 'address' => '15059 North Scottsdale Road, Scottsdale, AZ 85254', 'lat' => 33.6175, 'lon' => -111.8989],
            ['name' => 'Tempe Town Lake', 'address' => '72 East Rio Salado Parkway, Tempe, AZ 85281', 'lat' => 33.4316, 'lon' => -111.9393],
            ['name' => 'Gilbert Heritage District', 'address' => '80 North Gilbert Road, Gilbert, AZ 85234', 'lat' => 33.3528, 'lon' => -111.7890],
            ['name' => 'Mesa Riverview', 'address' => '1061 North Dobson Road, Mesa, AZ 85201', 'lat' => 33.4344, 'lon' => -111.8729],
            ['name' => 'Chandler Fashion Center', 'address' => '3111 West Chandler Boulevard, Chandler, AZ 85226', 'lat' => 33.3062, 'lon' => -111.8715],
            ['name' => 'Downtown Phoenix Office', 'address' => '2 North Central Avenue, Phoenix, AZ 85004', 'lat' => 33.4484, 'lon' => -112.0740],
            ['name' => 'Biltmore Fashion Park', 'address' => '2502 East Camelback Road, Phoenix, AZ 85016', 'lat' => 33.5088, 'lon' => -111.9780],
            ['name' => 'Peoria Sports Complex', 'address' => '16101 North 83rd Avenue, Peoria, AZ 85382', 'lat' => 33.6372, 'lon' => -112.2341],
            ['name' => 'Surprise Marketplace', 'address' => '13770 West Bell Road, Surprise, AZ 85374', 'lat' => 33.6385, 'lon' => -112.3684],
            // === Philadelphia (10) ===
            ['name' => 'Liberty Place', 'address' => '1650 Market Street, Philadelphia, PA 19103', 'lat' => 39.9530, 'lon' => -75.1681],
            ['name' => 'Rittenhouse Row', 'address' => '1811 Walnut Street, Philadelphia, PA 19103', 'lat' => 39.9497, 'lon' => -75.1714],
            ['name' => 'University City Science', 'address' => '3711 Market Street, Philadelphia, PA 19104', 'lat' => 39.9567, 'lon' => -75.1959],
            ['name' => 'Old City Loft', 'address' => '325 Chestnut Street, Philadelphia, PA 19106', 'lat' => 39.9491, 'lon' => -75.1469],
            ['name' => 'Fishtown Brewery', 'address' => '1537 North Front Street, Philadelphia, PA 19122', 'lat' => 39.9737, 'lon' => -75.1297],
            ['name' => 'Navy Yard Innovation', 'address' => '4747 South Broad Street, Philadelphia, PA 19112', 'lat' => 39.9050, 'lon' => -75.1717],
            ['name' => 'Manayunk Main Street', 'address' => '4338 Main Street, Philadelphia, PA 19127', 'lat' => 40.0269, 'lon' => -75.2258],
            ['name' => 'King of Prussia Mall', 'address' => '160 North Gulph Road, King of Prussia, PA 19406', 'lat' => 40.0889, 'lon' => -75.3927],
            ['name' => 'Conshohocken Office', 'address' => '300 Barr Harbor Drive, Conshohocken, PA 19428', 'lat' => 40.0696, 'lon' => -75.3165],
            ['name' => 'Northern Liberties', 'address' => '1001 North 2nd Street, Philadelphia, PA 19123', 'lat' => 39.9670, 'lon' => -75.1404],
            // === Dallas (10) ===
            ['name' => 'Reunion Tower District', 'address' => '300 Reunion Boulevard, Dallas, TX 75207', 'lat' => 32.7755, 'lon' => -96.8089],
            ['name' => 'Uptown Dallas Office', 'address' => '3811 Turtle Creek Boulevard, Dallas, TX 75219', 'lat' => 32.8057, 'lon' => -96.8044],
            ['name' => 'Deep Ellum Arts', 'address' => '2627 Main Street, Dallas, TX 75226', 'lat' => 32.7840, 'lon' => -96.7826],
            ['name' => 'Bishop Arts District', 'address' => '408 North Bishop Avenue, Dallas, TX 75208', 'lat' => 32.7479, 'lon' => -96.8271],
            ['name' => 'Legacy West Plano', 'address' => '5908 Headquarters Drive, Plano, TX 75024', 'lat' => 33.0756, 'lon' => -96.8234],
            ['name' => 'Las Colinas Urban Center', 'address' => '5205 North O Connor Boulevard, Irving, TX 75039', 'lat' => 32.8779, 'lon' => -96.9420],
            ['name' => 'Fort Worth Sundance Square', 'address' => '420 Main Street, Fort Worth, TX 76102', 'lat' => 32.7567, 'lon' => -97.3308],
            ['name' => 'Frisco Star', 'address' => '6655 Winning Drive, Frisco, TX 75034', 'lat' => 33.1215, 'lon' => -96.8345],
            ['name' => 'McKinney Town Center', 'address' => '111 North Tennessee Street, McKinney, TX 75069', 'lat' => 33.1976, 'lon' => -96.6156],
            ['name' => 'Arlington Entertainment', 'address' => '1000 Ballpark Way, Arlington, TX 76011', 'lat' => 32.7473, 'lon' => -97.0835],
            // === Washington DC (10) ===
            ['name' => 'Georgetown Waterfront', 'address' => '3000 K Street NW, Washington, DC 20007', 'lat' => 38.9025, 'lon' => -77.0597],
            ['name' => 'Dupont Circle Office', 'address' => '1350 Connecticut Avenue NW, Washington, DC 20036', 'lat' => 38.9087, 'lon' => -77.0417],
            ['name' => 'Capitol Hill Rowhouse', 'address' => '300 Pennsylvania Avenue SE, Washington, DC 20003', 'lat' => 38.8850, 'lon' => -77.0024],
            ['name' => 'Navy Yard Waterfront', 'address' => '1100 South Capitol Street SE, Washington, DC 20003', 'lat' => 38.8755, 'lon' => -77.0075],
            ['name' => 'Tysons Corner Center', 'address' => '1961 Chain Bridge Road, Tysons, VA 22102', 'lat' => 38.9175, 'lon' => -77.2230],
            ['name' => 'Bethesda Row', 'address' => '7130 Bethesda Lane, Bethesda, MD 20814', 'lat' => 38.9810, 'lon' => -77.0973],
            ['name' => 'Reston Town Center', 'address' => '11900 Market Street, Reston, VA 20190', 'lat' => 38.9586, 'lon' => -77.3594],
            ['name' => 'Alexandria Old Town', 'address' => '105 South Union Street, Alexandria, VA 22314', 'lat' => 38.8048, 'lon' => -77.0428],
            ['name' => 'Shaw/Howard Loft', 'address' => '1900 9th Street NW, Washington, DC 20001', 'lat' => 38.9170, 'lon' => -77.0228],
            ['name' => 'National Harbor', 'address' => '155 Waterfront Street, National Harbor, MD 20745', 'lat' => 38.7823, 'lon' => -77.0161],
            // === Nashville (10) ===
            ['name' => 'Broadway Honky Tonk Row', 'address' => '300 Broadway, Nashville, TN 37201', 'lat' => 36.1586, 'lon' => -86.7759],
            ['name' => 'The Gulch Mixed-Use', 'address' => '1201 Demonbreun Street, Nashville, TN 37203', 'lat' => 36.1517, 'lon' => -86.7870],
            ['name' => 'Germantown Office', 'address' => '1216 3rd Avenue North, Nashville, TN 37208', 'lat' => 36.1744, 'lon' => -86.7892],
            ['name' => 'Music Row Studios', 'address' => '34 Music Square East, Nashville, TN 37203', 'lat' => 36.1527, 'lon' => -86.7940],
            ['name' => 'East Nashville Creative', 'address' => '1008 Woodland Street, Nashville, TN 37206', 'lat' => 36.1734, 'lon' => -86.7609],
            ['name' => '12 South Retail', 'address' => '2509 12th Avenue South, Nashville, TN 37204', 'lat' => 36.1267, 'lon' => -86.7904],
            ['name' => 'Midtown Nashville Tower', 'address' => '1600 Division Street, Nashville, TN 37203', 'lat' => 36.1537, 'lon' => -86.7996],
            ['name' => 'Berry Hill Studio', 'address' => '2804 Bransford Avenue, Nashville, TN 37204', 'lat' => 36.1214, 'lon' => -86.7615],
            ['name' => 'Franklin Town Center', 'address' => '230 Franklin Road, Franklin, TN 37064', 'lat' => 35.9260, 'lon' => -86.8689],
            ['name' => 'Brentwood Office Park', 'address' => '5211 Maryland Way, Brentwood, TN 37027', 'lat' => 36.0326, 'lon' => -86.7828],
            // === Atlanta (10) ===
            ['name' => 'Peachtree Center', 'address' => '225 Peachtree Street NE, Atlanta, GA 30303', 'lat' => 33.7606, 'lon' => -84.3872],
            ['name' => 'Midtown Arts Center', 'address' => '999 Peachtree Street NE, Atlanta, GA 30309', 'lat' => 33.7816, 'lon' => -84.3834],
            ['name' => 'Buckhead Tower', 'address' => '3344 Peachtree Road NE, Atlanta, GA 30326', 'lat' => 33.8442, 'lon' => -84.3631],
            ['name' => 'Ponce City Market', 'address' => '675 Ponce de Leon Avenue NE, Atlanta, GA 30308', 'lat' => 33.7724, 'lon' => -84.3654],
            ['name' => 'Krog Street Market', 'address' => '99 Krog Street NE, Atlanta, GA 30307', 'lat' => 33.7578, 'lon' => -84.3637],
            ['name' => 'Westside Provisions', 'address' => '1198 Howell Mill Road NW, Atlanta, GA 30318', 'lat' => 33.7812, 'lon' => -84.4103],
            ['name' => 'Decatur Square', 'address' => '117 East Court Square, Decatur, GA 30030', 'lat' => 33.7748, 'lon' => -84.2963],
            ['name' => 'Sandy Springs Office', 'address' => '6065 Roswell Road NE, Sandy Springs, GA 30328', 'lat' => 33.9331, 'lon' => -84.3542],
            ['name' => 'Alpharetta Tech Park', 'address' => '2300 Windy Ridge Parkway, Alpharetta, GA 30005', 'lat' => 34.0271, 'lon' => -84.2824],
            ['name' => 'East Atlanta Village', 'address' => '470 Flat Shoals Avenue SE, Atlanta, GA 30316', 'lat' => 33.7405, 'lon' => -84.3424],
            // === Portland (10) ===
            ['name' => 'Pearl District Loft', 'address' => '1030 NW 12th Avenue, Portland, OR 97209', 'lat' => 45.5303, 'lon' => -122.6849],
            ['name' => 'Alberta Arts District', 'address' => '2000 NE Alberta Street, Portland, OR 97211', 'lat' => 45.5590, 'lon' => -122.6453],
            ['name' => 'Hawthorne Boulevard', 'address' => '3529 SE Hawthorne Boulevard, Portland, OR 97214', 'lat' => 45.5118, 'lon' => -122.6286],
            ['name' => 'Mississippi District', 'address' => '3930 North Mississippi Avenue, Portland, OR 97227', 'lat' => 45.5519, 'lon' => -122.6756],
            ['name' => 'Lloyd Center Office', 'address' => '825 NE Multnomah Street, Portland, OR 97232', 'lat' => 45.5305, 'lon' => -122.6509],
            ['name' => 'Division Street Hub', 'address' => '3540 SE Division Street, Portland, OR 97202', 'lat' => 45.5047, 'lon' => -122.6290],
            ['name' => 'Sellwood Retail', 'address' => '7875 SE 13th Avenue, Portland, OR 97202', 'lat' => 45.4694, 'lon' => -122.6534],
            ['name' => 'Lake Oswego Center', 'address' => '333 South State Street, Lake Oswego, OR 97034', 'lat' => 45.4207, 'lon' => -122.6706],
            ['name' => 'Hillsboro Tech', 'address' => '5500 NE Elam Young Parkway, Hillsboro, OR 97124', 'lat' => 45.5413, 'lon' => -122.9148],
            ['name' => 'Beaverton Round', 'address' => '12600 SW Crescent Street, Beaverton, OR 97005', 'lat' => 45.4910, 'lon' => -122.8008],
            // === Minneapolis (10) ===
            ['name' => 'IDS Center', 'address' => '80 South 8th Street, Minneapolis, MN 55402', 'lat' => 44.9764, 'lon' => -93.2720],
            ['name' => 'North Loop Warehouse', 'address' => '210 North 2nd Street, Minneapolis, MN 55401', 'lat' => 44.9846, 'lon' => -93.2695],
            ['name' => 'Uptown Minneapolis', 'address' => '3001 Hennepin Avenue, Minneapolis, MN 55408', 'lat' => 44.9475, 'lon' => -93.2993],
            ['name' => 'Northeast Arts Quarter', 'address' => '1500 Jackson Street NE, Minneapolis, MN 55413', 'lat' => 44.9970, 'lon' => -93.2466],
            ['name' => 'Mall of America Area', 'address' => '100 East Broadway, Bloomington, MN 55425', 'lat' => 44.8549, 'lon' => -93.2422],
            ['name' => 'Edina Southdale', 'address' => '6600 France Avenue South, Edina, MN 55435', 'lat' => 44.8802, 'lon' => -93.3282],
            ['name' => 'St Paul Lowertown', 'address' => '260 East 4th Street, St Paul, MN 55101', 'lat' => 44.9480, 'lon' => -93.0844],
            ['name' => 'Minnetonka Office', 'address' => '10400 Yellow Circle Drive, Minnetonka, MN 55343', 'lat' => 44.9303, 'lon' => -93.4589],
            ['name' => 'Plymouth Tech Center', 'address' => '5500 Nathan Lane North, Plymouth, MN 55442', 'lat' => 45.0190, 'lon' => -93.4244],
            ['name' => 'Wayzata Retail', 'address' => '730 East Lake Street, Wayzata, MN 55391', 'lat' => 44.9736, 'lon' => -93.5065],
            // === San Diego (10) ===
            ['name' => 'Gaslamp Quarter', 'address' => '410 Island Avenue, San Diego, CA 92101', 'lat' => 32.7141, 'lon' => -117.1600],
            ['name' => 'Little Italy Mixed-Use', 'address' => '1660 India Street, San Diego, CA 92101', 'lat' => 32.7224, 'lon' => -117.1683],
            ['name' => 'La Jolla Village', 'address' => '7835 Ivanhoe Avenue, La Jolla, CA 92037', 'lat' => 32.8473, 'lon' => -117.2742],
            ['name' => 'Mission Valley Center', 'address' => '1640 Camino Del Rio North, San Diego, CA 92108', 'lat' => 32.7651, 'lon' => -117.1559],
            ['name' => 'North Park Hub', 'address' => '3000 University Avenue, San Diego, CA 92104', 'lat' => 32.7494, 'lon' => -117.1291],
            ['name' => 'Del Mar Heights Office', 'address' => '12707 High Bluff Drive, San Diego, CA 92130', 'lat' => 32.9345, 'lon' => -117.2346],
            ['name' => 'Carlsbad Village', 'address' => '300 Carlsbad Village Drive, Carlsbad, CA 92008', 'lat' => 33.1581, 'lon' => -117.3506],
            ['name' => 'Hillcrest Retail', 'address' => '3930 5th Avenue, San Diego, CA 92103', 'lat' => 32.7491, 'lon' => -117.1617],
            ['name' => 'Sorrento Valley Tech', 'address' => '5005 Texas Street, San Diego, CA 92108', 'lat' => 32.7573, 'lon' => -117.1435],
            ['name' => 'Chula Vista Bayfront', 'address' => '631 L Street, Chula Vista, CA 91911', 'lat' => 32.6195, 'lon' => -117.0903],
            // === Detroit (10) ===
            ['name' => 'Detroit Riverfront', 'address' => '600 Renaissance Center, Detroit, MI 48243', 'lat' => 42.3293, 'lon' => -83.0398],
            ['name' => 'Midtown Detroit', 'address' => '4735 Cass Avenue, Detroit, MI 48201', 'lat' => 42.3558, 'lon' => -83.0669],
            ['name' => 'Corktown Warehouse', 'address' => '1460 Michigan Avenue, Detroit, MI 48216', 'lat' => 42.3314, 'lon' => -83.0677],
            ['name' => 'Eastern Market', 'address' => '2934 Russell Street, Detroit, MI 48207', 'lat' => 42.3495, 'lon' => -83.0398],
            ['name' => 'Royal Oak Downtown', 'address' => '301 South Main Street, Royal Oak, MI 48067', 'lat' => 42.4895, 'lon' => -83.1446],
            ['name' => 'Ann Arbor Main Street', 'address' => '330 South Main Street, Ann Arbor, MI 48104', 'lat' => 42.2795, 'lon' => -83.7488],
            ['name' => 'Troy Big Beaver', 'address' => '755 West Big Beaver Road, Troy, MI 48084', 'lat' => 42.5639, 'lon' => -83.1555],
            ['name' => 'Ferndale Retail', 'address' => '200 West 9 Mile Road, Ferndale, MI 48220', 'lat' => 42.4606, 'lon' => -83.1349],
            ['name' => 'Dearborn Office', 'address' => '1 American Road, Dearborn, MI 48126', 'lat' => 42.3124, 'lon' => -83.2347],
            ['name' => 'Birmingham Shopping', 'address' => '165 South Old Woodward Avenue, Birmingham, MI 48009', 'lat' => 42.5459, 'lon' => -83.2116],
            // === Charlotte (10) ===
            ['name' => 'Charlotte Uptown Tower', 'address' => '100 North Tryon Street, Charlotte, NC 28202', 'lat' => 35.2274, 'lon' => -80.8431],
            ['name' => 'South End Brewery', 'address' => '2000 South Boulevard, Charlotte, NC 28203', 'lat' => 35.2100, 'lon' => -80.8567],
            ['name' => 'NoDa Arts District', 'address' => '3229 North Davidson Street, Charlotte, NC 28205', 'lat' => 35.2471, 'lon' => -80.8130],
            ['name' => 'Plaza Midwood', 'address' => '1520 Central Avenue, Charlotte, NC 28205', 'lat' => 35.2225, 'lon' => -80.8168],
            ['name' => 'Ballantyne Corporate', 'address' => '15255 John J Delaney Drive, Charlotte, NC 28277', 'lat' => 35.0574, 'lon' => -80.8509],
            ['name' => 'SouthPark Mall Area', 'address' => '4400 Sharon Road, Charlotte, NC 28211', 'lat' => 35.1545, 'lon' => -80.8278],
            ['name' => 'Camp North End', 'address' => '1824 Statesville Avenue, Charlotte, NC 28206', 'lat' => 35.2457, 'lon' => -80.8515],
            ['name' => 'Dilworth Mixed-Use', 'address' => '1100 East Boulevard, Charlotte, NC 28203', 'lat' => 35.2098, 'lon' => -80.8443],
            ['name' => 'Mooresville Town Center', 'address' => '460 Town Center Drive, Mooresville, NC 28117', 'lat' => 35.5671, 'lon' => -80.8271],
            ['name' => 'Huntersville Commerce', 'address' => '9801 Sam Furr Road, Huntersville, NC 28078', 'lat' => 35.4107, 'lon' => -80.8768],
            // === Tampa (10) ===
            ['name' => 'Tampa Riverwalk', 'address' => '615 Channelside Drive, Tampa, FL 33602', 'lat' => 27.9427, 'lon' => -82.4502],
            ['name' => 'Hyde Park Village', 'address' => '1602 West Snow Avenue, Tampa, FL 33606', 'lat' => 27.9365, 'lon' => -82.4729],
            ['name' => 'Ybor City Historic', 'address' => '1600 East 8th Avenue, Tampa, FL 33605', 'lat' => 27.9620, 'lon' => -82.4371],
            ['name' => 'Westshore Business', 'address' => '4830 West Kennedy Boulevard, Tampa, FL 33609', 'lat' => 27.9490, 'lon' => -82.5231],
            ['name' => 'St Petersburg EDGE', 'address' => '200 Central Avenue, St Petersburg, FL 33701', 'lat' => 27.7710, 'lon' => -82.6384],
            ['name' => 'Clearwater Beach', 'address' => '100 Coronado Drive, Clearwater, FL 33767', 'lat' => 27.9764, 'lon' => -82.8268],
            ['name' => 'Sarasota Main Street', 'address' => '1541 Main Street, Sarasota, FL 34236', 'lat' => 27.3364, 'lon' => -82.5401],
            ['name' => 'Brandon Town Center', 'address' => '459 Brandon Town Center Drive, Brandon, FL 33511', 'lat' => 27.9356, 'lon' => -82.2856],
            ['name' => 'Wesley Chapel Grove', 'address' => '6091 Wesley Grove Boulevard, Wesley Chapel, FL 33544', 'lat' => 28.1930, 'lon' => -82.3563],
            ['name' => 'Lakeland Downtown', 'address' => '228 South Florida Avenue, Lakeland, FL 33801', 'lat' => 28.0395, 'lon' => -81.9498],
            // === Salt Lake City (10) ===
            ['name' => 'City Creek Center', 'address' => '50 South Main Street, Salt Lake City, UT 84101', 'lat' => 40.7680, 'lon' => -111.8910],
            ['name' => 'Sugar House Crossing', 'address' => '2157 South Highland Drive, Salt Lake City, UT 84106', 'lat' => 40.7233, 'lon' => -111.8563],
            ['name' => 'Gateway District', 'address' => '18 North Rio Grande Street, Salt Lake City, UT 84101', 'lat' => 40.7685, 'lon' => -111.9047],
            ['name' => 'Sandy Tech Hub', 'address' => '10011 Centennial Parkway, Sandy, UT 84070', 'lat' => 40.5669, 'lon' => -111.8879],
            ['name' => 'Lehi Silicon Slopes', 'address' => '2600 West Executive Parkway, Lehi, UT 84043', 'lat' => 40.4269, 'lon' => -111.8979],
            ['name' => 'Provo Center Street', 'address' => '86 North University Avenue, Provo, UT 84601', 'lat' => 40.2338, 'lon' => -111.6585],
            ['name' => 'Ogden 25th Street', 'address' => '202 25th Street, Ogden, UT 84401', 'lat' => 41.2275, 'lon' => -111.9697],
            ['name' => 'Park City Main', 'address' => '333 Main Street, Park City, UT 84060', 'lat' => 40.6461, 'lon' => -111.4980],
            ['name' => 'Draper Office Park', 'address' => '13693 South 200 West, Draper, UT 84020', 'lat' => 40.5247, 'lon' => -111.8939],
            ['name' => 'Murray Retail Center', 'address' => '5900 South State Street, Murray, UT 84107', 'lat' => 40.6544, 'lon' => -111.8882],
            // === Bonus: Las Vegas (10) ===
            ['name' => 'Las Vegas Strip Tower', 'address' => '3600 Las Vegas Boulevard South, Las Vegas, NV 89109', 'lat' => 36.1215, 'lon' => -115.1739],
            ['name' => 'Fremont Street Experience', 'address' => '425 Fremont Street, Las Vegas, NV 89101', 'lat' => 36.1699, 'lon' => -115.1424],
            ['name' => 'Summerlin Town Center', 'address' => '1980 Festival Plaza Drive, Las Vegas, NV 89135', 'lat' => 36.1584, 'lon' => -115.3380],
            ['name' => 'Henderson Green Valley', 'address' => '2225 Village Walk Drive, Henderson, NV 89052', 'lat' => 36.0121, 'lon' => -115.1012],
            ['name' => 'Downtown Container Park', 'address' => '707 Fremont Street, Las Vegas, NV 89101', 'lat' => 36.1673, 'lon' => -115.1371],
            ['name' => 'Arts District Loft', 'address' => '1025 South 1st Street, Las Vegas, NV 89101', 'lat' => 36.1596, 'lon' => -115.1530],
            ['name' => 'Spring Valley Office', 'address' => '6620 West Flamingo Road, Las Vegas, NV 89103', 'lat' => 36.1142, 'lon' => -115.2350],
            ['name' => 'North Las Vegas Commerce', 'address' => '2550 Las Vegas Boulevard North, North Las Vegas, NV 89030', 'lat' => 36.2117, 'lon' => -115.1222],
            ['name' => 'Enterprise Business', 'address' => '8945 South Eastern Avenue, Las Vegas, NV 89123', 'lat' => 36.0481, 'lon' => -115.1189],
            ['name' => 'Boulder City Historic', 'address' => '501 Nevada Way, Boulder City, NV 89005', 'lat' => 35.9628, 'lon' => -114.8326],
            // === Bonus: Raleigh (10) ===
            ['name' => 'Raleigh Downtown Tower', 'address' => '150 Fayetteville Street, Raleigh, NC 27601', 'lat' => 35.7796, 'lon' => -78.6382],
            ['name' => 'North Hills Midtown', 'address' => '4421 Six Forks Road, Raleigh, NC 27609', 'lat' => 35.8395, 'lon' => -78.6411],
            ['name' => 'Durham Bulls District', 'address' => '409 Blackwell Street, Durham, NC 27701', 'lat' => 35.9926, 'lon' => -78.9030],
            ['name' => 'Chapel Hill Franklin Street', 'address' => '140 East Franklin Street, Chapel Hill, NC 27514', 'lat' => 35.9132, 'lon' => -79.0531],
            ['name' => 'Research Triangle Park', 'address' => '12 Davis Drive, Durham, NC 27709', 'lat' => 35.8985, 'lon' => -78.8639],
            ['name' => 'Cary Town Center', 'address' => '1105 Walnut Street, Cary, NC 27511', 'lat' => 35.7865, 'lon' => -78.7811],
            ['name' => 'Glenwood South', 'address' => '510 Glenwood Avenue, Raleigh, NC 27603', 'lat' => 35.7857, 'lon' => -78.6478],
            ['name' => 'Warehouse District', 'address' => '325 West Davie Street, Raleigh, NC 27601', 'lat' => 35.7744, 'lon' => -78.6439],
            ['name' => 'Morrisville Park Place', 'address' => '1001 Airport Boulevard, Morrisville, NC 27560', 'lat' => 35.8233, 'lon' => -78.8277],
            ['name' => 'Wake Forest Town Center', 'address' => '420 Brooks Street, Wake Forest, NC 27587', 'lat' => 35.9799, 'lon' => -78.5097],
            // === Bonus: Columbus OH (10) ===
            ['name' => 'Columbus Short North', 'address' => '700 North High Street, Columbus, OH 43215', 'lat' => 39.9772, 'lon' => -83.0031],
            ['name' => 'German Village', 'address' => '588 South Third Street, Columbus, OH 43215', 'lat' => 39.9495, 'lon' => -82.9902],
            ['name' => 'Easton Town Center', 'address' => '160 Easton Town Center, Columbus, OH 43219', 'lat' => 40.0505, 'lon' => -82.9143],
            ['name' => 'Dublin Bridge Park', 'address' => '6540 Riverside Drive, Dublin, OH 43017', 'lat' => 40.0992, 'lon' => -83.1240],
            ['name' => 'Grandview Yard', 'address' => '1255 Grandview Avenue, Columbus, OH 43212', 'lat' => 39.9838, 'lon' => -83.0419],
            ['name' => 'Polaris Fashion Place', 'address' => '1500 Polaris Parkway, Columbus, OH 43240', 'lat' => 40.1458, 'lon' => -82.9815],
            ['name' => 'Worthington Square', 'address' => '7227 North High Street, Worthington, OH 43085', 'lat' => 40.0932, 'lon' => -82.9856],
            ['name' => 'Clintonville Hub', 'address' => '3417 North High Street, Columbus, OH 43202', 'lat' => 40.0220, 'lon' => -83.0130],
            ['name' => 'Brewery District', 'address' => '503 South Front Street, Columbus, OH 43215', 'lat' => 39.9527, 'lon' => -83.0058],
            ['name' => 'Upper Arlington Office', 'address' => '1945 Northwest Boulevard, Columbus, OH 43212', 'lat' => 39.9859, 'lon' => -83.0633],
        ];
    }
}

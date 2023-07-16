// Create the Leaflet map
let myMap = L.map("map", {
  center: [37.7749, -122.4194],
  zoom: 13
});

// Adding the tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(myMap);

// D3 to get the JSON data
d3.json("https://data.sfgov.org/resource/6ia5-2f8k.json").then(function(neighborhoodData) {
  // Convert JSON data to GeoJSON format
  let geojson = {
    type: "FeatureCollection",
    features: neighborhoodData.map(item => {
      return {
        type: "Feature",
        properties: {
          name: item.name,
          coordinates: item.the_geom.coordinates
        },
        geometry: {
          type: "MultiPolygon",
          coordinates: item.the_geom.coordinates
        }
      };
    })
  };

  // D3 to get the JSON data
  d3.json("https://data.sfgov.org/resource/pyih-qa8i.json").then(function(inspectionData) {
    // Create an object to hold the inspection scores for each neighborhood
    let inspectionScores = {};

    let uniqueBusinesses = new Set();

    // Group inspection scores by neighborhood
    inspectionData.forEach(item => {
      if (item.business_location && item.inspection_score !== undefined) {
        let businessCoordinates = item.business_location.coordinates;
        let inspectionScore = parseFloat(item.inspection_score);
        // Check if the business coordinates fall within any neighborhood's coordinates
        let neighborhood = geojson.features.find(feature =>
          turf.booleanPointInPolygon(turf.point(businessCoordinates), feature.geometry)
        );
        if (neighborhood) {
          let businessIdentifier = item.business_name; // Use business_name as the unique identifier
          let neighborhoodCoordinates = JSON.stringify(neighborhood.geometry.coordinates);
          if (neighborhoodCoordinates in inspectionScores) {
            inspectionScores[neighborhoodCoordinates].push(inspectionScore);
          } else {
            inspectionScores[neighborhoodCoordinates] = [inspectionScore];
          }
          uniqueBusinesses.add(businessIdentifier); // Add business identifier to the Set
        }
      }
    });

    // Get the total number of unique businesses
    let totalBusinessesWithScores = uniqueBusinesses.size;

    //console.log("Total Businesses with Inspection Scores:", totalBusinessesWithScores);

    // Iterate over the geojson features and calculate the average inspection score for each neighborhood
    geojson.features.forEach(feature => {
      let coordinates = JSON.stringify(feature.geometry.coordinates);
      // Check if the coordinates exist in the inspectionScores object
      if (coordinates in inspectionScores) {
        let scores = inspectionScores[coordinates];
        let numericScores = scores.map(score => parseFloat(score)); // Convert scores to numbers
        let average = Math.round(numericScores.reduce((total, score) => total + score, 0) / numericScores.length);
        feature.properties.average_inspection_score = average;
      } else {
        feature.properties.average_inspection_score = undefined;
      }
    });

    // Create the choropleth layer using L.choropleth
    let choroplethLayer = L.choropleth(geojson, {
      valueProperty: "average_inspection_score",
      scale: 'viridis', // Gray, Red, Yellow, Green for the color scale
      steps: 4,
      mode: "q",
      style: function (feature) {
        return {
          color: "black",
          fillColor: feature.properties.average_inspection_score,
          weight: 1,
          fillOpacity: 0.5
        };
      },
      onEachFeature: function (feature, layer) {
        let neighborhood = feature.properties.name;
        let score = feature.properties.average_inspection_score;
        let popupContent = "Neighborhood: " + neighborhood + "<br>";
        if (score !== undefined) {
          popupContent += "Average Inspection Score: " + (score ? score.toFixed(0) : "No data");
        } else {
          popupContent += "No data";
        }

        // Variables to store business count, highest score, lowest score, and their respective business names
        let businessCount = 0;
        let highestScore = -Infinity;
        let lowestScore = Infinity;
        let highestBusiness = "";
        let lowestBusiness = "";

        // Calculate business count, highest score, and lowest score for each neighborhood
        inspectionData.forEach(item => {
          if (
            item.business_location &&
            item.inspection_score !== undefined &&
            turf.booleanPointInPolygon(turf.point(item.business_location.coordinates), feature.geometry)
          ) {
            businessCount++;
            let inspectionScore = parseFloat(item.inspection_score);
            if (inspectionScore > highestScore) {
              highestScore = inspectionScore;
              highestBusiness = item.business_name;
            }
            if (inspectionScore < lowestScore) {
              lowestScore = inspectionScore;
              lowestBusiness = item.business_name;
            }
          }
        });

        // Update the popupContent to include business count, highest score, and lowest score with their respective business names
        popupContent += "<br>Business Count: " + businessCount; // Add business count to the popup
        popupContent += "<br>Highest Score: <span class='highest-score score'>" + (highestScore !== -Infinity ? highestScore : "N/A") + "</span> (Business: " + (highestBusiness !== "" ? highestBusiness : "N/A") + ")"; // Add highest score and business name
        popupContent += "<br>Lowest Score: <span class='lowest-score score'>" + (lowestScore !== Infinity ? lowestScore : "N/A") + "</span> (Business: " + (lowestBusiness !== "" ? lowestBusiness : "N/A") + ")"; // Add lowest score and business name

        layer.bindPopup(popupContent, {
          closeButton: true // Enable the default close button
        });

        layer.on("click", function () {
          // Log the feature data
          console.log("Feature:", feature);
          console.log("Average Inspection Score:", score);
          console.log("Business Count:", businessCount);
          console.log("Highest Score:", highestScore, "(Business:", highestBusiness + ")");
          console.log("Lowest Score:", lowestScore, "(Business:", lowestBusiness + ")");
        });

        layer.on("popupclose", function () {
          layer.setStyle({
            weight: 1 // Reset the layer style when the popup is closed
          });
        });

        layer.on("popupopen", function () {
          layer.setStyle({
            weight: 3 // Increase the layer weight when the popup is opened
          });
        });
      }
    }).addTo(myMap);

    // Set up the legend
    var legend = L.control({ position: "topright" });
    legend.onAdd = function() {
      var div = L.DomUtil.create("div", "legend");
      var steps = 7; // Number of steps
      var startColor = '#440154'; // Start color (green)
      var middleColor = "#31688E"; // Middle color
      var endColor = "yellow"; // End color (yellow)

      // Generate the color scale using Chroma.js
      var colors = chroma.scale([startColor, middleColor, endColor]).colors(steps);

      // Generate the legend based on the colors
      var limits = ["65-70", "70-75", "75-80", "80-85", "85-90", "90-95", "95-100"];

      let labels = [];
      // Add the legend title.
      div.innerHTML += '<h4 style="text-align: center;">City of San Francisco Public Health<br>Restaurant Sanitation Inspection Scores<br><span style="font-size: 14px; font-weight: bold;">(by neighborhood)</span></h4>';
      // Create the legend color bar.
      for (var i = 0; i < limits.length; i++) {
        var colorRange = limits[i];
        div.innerHTML +=
          '<i style="background:' + colors[i] + '"></i> ' +
          colorRange + '<br>';
      }
      return div;
    };
    // Adding the legend to the map
    legend.addTo(myMap);
    // Fit the map bounds to the choropleth layer
    myMap.fitBounds(choroplethLayer.getBounds());

    // Event handler for when a neighborhood is clicked on the map
    // Event handler for when a neighborhood is clicked on the map
    // Event handler for when a neighborhood is clicked on the map
function onNeighborhoodClick(event) {
  let neighborhood = event.target.feature.properties.name;
  let neighborhoodPolygon = event.target.feature.geometry;

  let businesses = inspectionData.filter(item => {
    if (item.business_location && item.inspection_score !== undefined) {
      let businessCoordinates = item.business_location.coordinates;
      let point = turf.point(businessCoordinates);
      return turf.booleanPointInPolygon(point, neighborhoodPolygon);
    }
    return false;
  });

  let businessNames = businesses.map(item => item.business_name);
  console.log("Businesses in", neighborhood, ":", businessNames);

  let unmappedBusinesses = inspectionData.filter(item => {
    if (item.business_location && item.inspection_score !== undefined) {
      let businessCoordinates = item.business_location.coordinates;
      let point = turf.point(businessCoordinates);
      return !turf.booleanPointInPolygon(point, neighborhoodPolygon);
    }
    return false;
  });

  console.log("Businesses with Inspection Scores not mapped:", unmappedBusinesses.length);
}
   


    // Bind the click event to the choropleth layer
    choroplethLayer.eachLayer(layer => {
      layer.on("click", onNeighborhoodClick);
    });

  }).catch(function(error) {
    console.error("Error fetching inspection data:", error);
  });
}).catch(function(error) {
  console.error("Error fetching neighborhood data:", error);
});

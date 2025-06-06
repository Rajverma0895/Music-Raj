// filterLogic.js

// IIFE to create a scope and expose functions to a global namespace (e.g., App.filterLogic)
(function(app) {
    'use strict';

    const filterLogic = {};

    /**
     * Filters a list of tracks based on provided criteria.
     * @param {Array<Object>} tracks - The array of trackData objects to filter.
     * @param {Object} filters - An object containing filter criteria.
     *                           Example: { genre: 'Rock', year: '2000', searchTerm: 'love' }
     *                           'searchTerm' is handled by the main script's search for now.
     *                           This function focuses on genre/year.
     * @returns {Array<Object>} A new array of tracks that match the criteria.
     */
    filterLogic.applyAdvancedFilters = function(tracks, activeFilters) {
        if (!tracks) return [];
        let filteredTracks = tracks;

        // Genre filter
        if (activeFilters.genre && activeFilters.genre !== '') {
            filteredTracks = filteredTracks.filter(track =>
                track.metadata && track.metadata.genre &&
                track.metadata.genre.toLowerCase() === activeFilters.genre.toLowerCase()
            );
        }

        // Year filter
        if (activeFilters.year && activeFilters.year !== '') {
            filteredTracks = filteredTracks.filter(track =>
                track.metadata && track.metadata.year &&
                track.metadata.year.toString() === activeFilters.year.toString()
            );
        }

        // Add more filters here if needed in the future (e.g., artist, album)

        return filteredTracks;
    };

    /**
     * Extracts unique genres from a list of tracks.
     * @param {Array<Object>} tracks - The array of trackData objects.
     * @returns {Array<String>} An array of unique genre strings, sorted alphabetically.
     */
    filterLogic.getUniqueGenres = function(tracks) {
        if (!tracks) return [];
        const genres = new Set();
        tracks.forEach(track => {
            if (track.metadata && track.metadata.genre && track.metadata.genre !== 'Unknown Genre') {
                genres.add(track.metadata.genre);
            }
        });
        return Array.from(genres).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    };

    /**
     * Extracts unique years from a list of tracks.
     * @param {Array<Object>} tracks - The array of trackData objects.
     * @returns {Array<String>} An array of unique year strings, sorted numerically (descending).
     */
    filterLogic.getUniqueYears = function(tracks) {
        if (!tracks) return [];
        const years = new Set();
        tracks.forEach(track => {
            if (track.metadata && track.metadata.year && track.metadata.year !== 'Unknown Year') {
                // Ensure year is treated as a string if it might be numeric
                years.add(String(track.metadata.year));
            }
        });
        // Sort years: typically descending for recency
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    };

    // Expose the filterLogic object to the global app namespace
    // This assumes 'app' is a global object initialized in script.js (e.g., window.App = {})
    if (!app.filterLogic) {
        app.filterLogic = filterLogic;
    } else {
        console.warn('App.filterLogic already exists. Check for duplicate script loading or naming conflicts.');
    }

})(window.App = window.App || {}); // Pass in App namespace or create it

// ======================================
// SUPABASE CONNECTION
// ======================================

import {
    createClient
} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';


// ======================================
// SUPABASE PROJECT DETAILS
// ======================================

const supabaseUrl =
    'https://leblwhnkcwlhmcjjhtse.supabase.co';


const supabasePublishableKey =
    'sb_publishable_YUf854seJwPQcoEE1j9FAw_PUpvQKbo';


// ======================================
// CREATE SUPABASE CLIENT
// ======================================

const supabase =
    createClient(
        supabaseUrl,
        supabasePublishableKey
    );


// ======================================
// EXPORT CLIENT
// ======================================

export {
    supabase
};
const { createClient } = require('@supabase/supabase-js'); // ESTO TIENE QUE ESTAR AQUÍ
const path = require('path');
const db = require(path.join(__dirname, '../config/db.js'));
require('dotenv').config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const Movimiento = {

    // Inserta un nuevo movimiento en la tabla movimientos
    async crear(datos) {
        const { data, error } = await supabase
            .from('movimientos')
            .insert([datos])
            .select(); // ← Obliga a Supabase a devolver la fila recién insertada
        
        if (error) console.error("Error en Movimiento.crear:", error.message);
        return { data, error };
    },

    // Actualiza el saldo de una cuenta bancaria
    async actualizarSaldo(id_cuenta, nuevoSaldo) {
        const { data, error } = await supabase
            .from('cuentas_bancarias')
            .update({ saldo: nuevoSaldo })
            .eq('id_cuenta', id_cuenta)
            .select(); // ← Devuelve la fila con el saldo actualizado
            
        if (error) console.error("Error en Movimiento.actualizarSaldo:", error.message);
        return { data, error };
    }

};

module.exports = Movimiento;
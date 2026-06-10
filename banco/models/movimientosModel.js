require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const Movimiento = {
    // Función para insertar un movimiento
    async crear(datos) {
        const { data, error } = await supabase
            .from('movimientos')
            .insert([datos]);
        return { data, error };
    },

    // Función para actualizar el saldo de la cuenta
    async actualizarSaldo(id_cuenta, nuevoSaldo) {
        const { data, error } = await supabase
            .from('cuentas_bancarias')
            .update({ saldo: nuevoSaldo })
            .eq('id_cuenta', id_cuenta);
        return { data, error };
    }
};

module.exports = Movimiento;
import { AccountSheet } from "@/components/account/account-sheet";
import { UserModalProps } from "@/types/components";

/**
 * Compatibilidad con las pantallas del owner que abren la cuenta desde su propio botón.
 * Muestra la misma hoja de cuenta que el avatar del resto de los roles.
 */
export function UserModal({ modalVisible, setModalVisible }: UserModalProps) {
    return <AccountSheet visible={modalVisible} onClose={() => setModalVisible(false)} />;
}

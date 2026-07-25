import SignOutButton from "@/components/sign-out-button";
import { ThemedText } from "@/components/themed-text";
import { Role } from "@/hooks/useAuth";
import {
    User
} from "firebase/auth";
import { Dispatch, SetStateAction } from 'react';
import {
    Modal,
    TouchableOpacity,
    View,
} from "react-native";


export function UserModal({ modalVisible, setModalVisible, user, role, userInitial }: { modalVisible: boolean, setModalVisible: Dispatch<SetStateAction<boolean>>, user: User | null, role: Role | null, userInitial: string }) {
    return (<Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
    >
        <TouchableOpacity
            className="flex-1 bg-black/50"
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
        >
            <View
                className="mt-auto bg-brand-white rounded-t-3xl pt-2 pb-10 px-6 shadow-lg"
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e.stopPropagation()}
            >
                <View className="w-12 h-1.5 bg-slate-300 rounded-full self-center mb-6" />

                <View className="items-center mb-6">
                    <View className="w-20 h-20 rounded-full bg-brand-blue items-center justify-center shadow-sm mb-4">
                        <ThemedText className="text-white font-bold text-3xl">
                            {userInitial}
                        </ThemedText>
                    </View>

                    <ThemedText type="subtitle" className="text-center mb-1">
                        Mi Cuenta
                    </ThemedText>
                    <ThemedText type="caption" className="text-center mb-4">
                        {user?.email}
                    </ThemedText>

                    <View className="flex-row space-x-2 mb-6">
                        <View className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                            <ThemedText type="caption" className="font-bold text-brand-blue">
                                ROL: {role}
                            </ThemedText>
                        </View>
                        <View className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                            <ThemedText type="caption" className="font-bold text-brand-gold">
                                VERIFICADO
                            </ThemedText>
                        </View>
                    </View>
                </View>

                <SignOutButton />
            </View>
        </TouchableOpacity>
    </Modal>);
}
